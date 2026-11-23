import { Router, type NextFunction, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db, supportLinksTable, supportMessagesTable, supportTicketsTable, usersTable } from "@workspace/db";
import {
  CloseSupportTicketParams, CloseSupportTicketResponse, CreateSupportTicketBody,
  GetSupportLinksResponse, GetSupportTicketParams, GetSupportTicketResponse, ListSupportTicketsQueryParams,
  ListSupportTicketsResponse, ReplyToSupportTicketBody, ReplyToSupportTicketParams,
  SaveSupportLinksBody, SaveSupportLinksResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { requireAdminAuth, requireAuthOrAdmin, type AdminAuthedRequest } from "../lib/adminAuth";
import { renderEmail, sendEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();
const t = supportTicketsTable;
const m = supportMessagesTable;
const pageSize = 30;
const supportInbox = "zbarberbook.tg@gmail.com";
const settingsId = 1;
const emptyLinks = { whatsapp: null, tiktok: null, instagram: null, facebook: null };
const ticketColumns = { id: t.id, category: t.category, subject: t.subject, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt };
const messageColumns = { id: m.id, author: m.author, message: m.message, createdAt: m.createdAt };
type SupportRequest = AuthedRequest & AdminAuthedRequest;

function noStore(_req: Request, res: Response, next: NextFunction) {
  res.set("Cache-Control", "private, no-store");
  next();
}

function unlockedAdmin(req: AdminAuthedRequest, res: Response, next: NextFunction) {
  if (req.admin?.mustChangePassword) { res.status(403).json({ error: "Changez votre mot de passe administrateur." }); return; }
  next();
}

function readScope(req: SupportRequest) {
  return req.admin ? undefined : eq(t.userId, req.localUser!.id);
}

function linksAreValid(links: typeof SaveSupportLinksBody._output) {
  const hosts = { tiktok: ["tiktok.com"], instagram: ["instagram.com"], facebook: ["facebook.com", "fb.com"] } as const;
  return (Object.keys(hosts) as (keyof typeof hosts)[]).every((key) => {
    const value = links[key];
    if (value === null) return true;
    try {
      const url = new URL(value);
      return /^https:\/\//i.test(value) && url.protocol === "https:" && !url.username && !url.password && !url.port &&
        hosts[key].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch { return false; }
  });
}

function alertNewTicket(id: number) {
  // Keep the conversation private: the email contains only a reference, not its text or identity.
  const heading = `Nouveau ticket d’assistance #${id}`;
  const subject = `[Zbarber] ${heading}`;
  const content = renderEmail({
    title: subject,
    heading,
    intro: "Une nouvelle demande d’assistance a été créée.",
    note: "Ouvrez la rubrique Assistance dans l’administration Zbarber pour la consulter.",
  });
  void sendEmail({
    to: supportInbox,
    subject,
    ...content,
  }).then(({ delivered }) => {
    if (!delivered) logger.warn({ ticketId: id }, "Support ticket saved, but its email alert was not delivered");
  }).catch(() => logger.error({ ticketId: id }, "Support ticket email alert failed"));
}

router.get("/support/links", noStore, async (_req, res): Promise<void> => {
  const [links] = await db.select().from(supportLinksTable).where(eq(supportLinksTable.id, settingsId));
  res.json(GetSupportLinksResponse.parse(links ?? emptyLinks));
});

router.put("/support/links", noStore, requireAdminAuth, unlockedAdmin, async (req, res): Promise<void> => {
  const parsed = SaveSupportLinksBody.safeParse(req.body);
  if (!parsed.success || !linksAreValid(parsed.data)) {
    res.status(400).json({ error: "Saisissez un numéro WhatsApp international et des liens HTTPS vers les réseaux correspondants." });
    return;
  }
  const [links] = await db.insert(supportLinksTable).values({ id: settingsId, ...parsed.data })
    .onConflictDoUpdate({ target: supportLinksTable.id, set: parsed.data }).returning();
  res.json(SaveSupportLinksResponse.parse(links));
});

router.get("/support/tickets", noStore, requireAuthOrAdmin, unlockedAdmin, async (req: SupportRequest, res): Promise<void> => {
  const query = ListSupportTicketsQueryParams.safeParse(req.query);
  if (!query.success || (query.data.before !== undefined && !Number.isInteger(query.data.before))) {
    res.status(400).json({ error: "Pagination invalide." }); return;
  }
  const where = and(readScope(req), query.data.before === undefined ? undefined : lt(t.id, query.data.before));
  const rows = req.admin
    ? await db.select({ ...ticketColumns, requesterName: usersTable.name }).from(t)
      .innerJoin(usersTable, eq(t.userId, usersTable.id)).where(where).orderBy(desc(t.id)).limit(pageSize + 1)
    : await db.select(ticketColumns).from(t).where(where).orderBy(desc(t.id)).limit(pageSize + 1);
  res.json(ListSupportTicketsResponse.parse({
    items: rows.slice(0, pageSize),
    nextBefore: rows.length > pageSize ? rows[pageSize - 1]!.id : null,
  }));
});

router.post("/support/tickets", noStore, requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const body = CreateSupportTicketBody.safeParse({
    category: req.body?.category,
    subject: typeof req.body?.subject === "string" ? req.body.subject.trim() : undefined,
    message: typeof req.body?.message === "string" ? req.body.message.trim() : undefined,
  });
  if (!body.success) { res.status(400).json({ error: "Choisissez une catégorie, un sujet et décrivez votre demande." }); return; }
  const userId = req.localUser!.id;
  const { category, subject, message } = body.data;
  const result = await db.transaction(async (tx) => {
    // Serialize creation per account to limit email spam, including parallel submissions.
    await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).for("update");
    const recent = await tx.select({ id: t.id }).from(t)
      .where(and(eq(t.userId, userId), gte(t.createdAt, new Date(Date.now() - 3_600_000)))).limit(5);
    if (recent.length >= 5) return null;
    const [ticket] = await tx.insert(t).values({ userId, category, subject }).returning(ticketColumns);
    const [first] = await tx.insert(m).values({ ticketId: ticket!.id, author: "user", message }).returning(messageColumns);
    return { ticket: ticket!, messages: [first!] };
  });
  if (!result) { res.status(429).json({ error: "Trop de tickets créés récemment. Réessayez dans une heure." }); return; }
  alertNewTicket(result.ticket.id);
  res.status(201).json(GetSupportTicketResponse.parse(result));
});

router.get("/support/tickets/:id", noStore, requireAuthOrAdmin, unlockedAdmin, async (req: SupportRequest, res): Promise<void> => {
  const params = GetSupportTicketParams.safeParse(req.params);
  if (!params.success || !Number.isInteger(params.data.id)) { res.status(400).json({ error: "Ticket invalide." }); return; }
  const where = and(eq(t.id, params.data.id), readScope(req));
  const [ticket] = req.admin
    ? await db.select({ ...ticketColumns, requesterName: usersTable.name }).from(t)
      .innerJoin(usersTable, eq(t.userId, usersTable.id)).where(where)
    : await db.select(ticketColumns).from(t).where(where);
  if (!ticket) { res.status(404).json({ error: "Ticket introuvable." }); return; }
  const messages = await db.select(messageColumns).from(m).where(eq(m.ticketId, ticket.id)).orderBy(asc(m.id));
  res.json(GetSupportTicketResponse.parse({ ticket, messages }));
});

router.post("/support/tickets/:id/messages", noStore, requireAuthOrAdmin, unlockedAdmin, async (req: SupportRequest, res): Promise<void> => {
  const params = ReplyToSupportTicketParams.safeParse(req.params);
  const body = ReplyToSupportTicketBody.safeParse({ message: typeof req.body?.message === "string" ? req.body.message.trim() : undefined });
  if (!params.success || !Number.isInteger(params.data.id) || !body.success) {
    res.status(400).json({ error: "Saisissez un message valide." }); return;
  }
  const where = and(eq(t.id, params.data.id), readScope(req));
  const author = req.admin ? "admin" : "user";
  const reply = await db.transaction(async (tx) => {
    // UPDATE rechecks status after lock acquisition; a concurrent close cannot admit a late message.
    const [changed] = await tx.update(t).set({ updatedAt: new Date() })
      .where(and(where, eq(t.status, "open"))).returning({ id: t.id });
    if (!changed) {
      const [visible] = await tx.select({ id: t.id }).from(t).where(where);
      return visible ? "closed" : "not-found";
    }
    const [entry] = await tx.insert(m).values({ ticketId: changed.id, author, message: body.data.message }).returning(messageColumns);
    return entry!;
  });
  if (reply === "not-found") { res.status(404).json({ error: "Ticket introuvable." }); return; }
  if (reply === "closed") { res.status(409).json({ error: "Cette conversation est clôturée." }); return; }
  res.status(201).json(GetSupportTicketResponse.shape.messages.element.parse(reply));
});

router.post("/support/tickets/:id/close", noStore, requireAdminAuth, unlockedAdmin, async (req, res): Promise<void> => {
  const params = CloseSupportTicketParams.safeParse(req.params);
  if (!params.success || !Number.isInteger(params.data.id)) { res.status(400).json({ error: "Ticket invalide." }); return; }
  const where = eq(t.id, params.data.id);
  const [closed] = await db.update(t).set({ status: "closed", updatedAt: new Date() })
    .where(and(where, eq(t.status, "open"))).returning(ticketColumns);
  const ticket = closed ?? (await db.select(ticketColumns).from(t).where(where))[0];
  if (!ticket) { res.status(404).json({ error: "Ticket introuvable." }); return; }
  res.json(CloseSupportTicketResponse.parse(ticket));
});

export default router;
