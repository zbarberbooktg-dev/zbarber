import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, usersTable, accountDeletionRequestsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { notifyAdmin } from "../lib/email";
import { anonymizeUserAccount } from "../lib/accountAnonymize";

const router = Router();

// ── Authenticated: delete my account ───
// Anonymizes the user row (preserving reservations/reviews referential
// integrity), suspends any owned salon(s), and deletes the Clerk user.
router.delete("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  try {
    await anonymizeUserAccount(user.id, req.log);
    res.json({ ok: true });
  } catch (e) {
    req.log?.error?.({ err: e, userId: user.id }, "Account deletion failed");
    res.status(500).json({ error: "Account deletion failed" });
  }
});

// ── Public: deletion request (used by the vitrine, no auth) ───
router.post("/account-deletion-requests", async (req, res) => {
  const body = z.object({
    email: z.string().email(),
    fullName: z.string().min(2).optional(),
    reason: z.string().max(2000).optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  // Best-effort link to an existing user (does not authenticate; informational only)
  const [linked] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, body.data.email.toLowerCase()))
    .limit(1);

  const [created] = await db.insert(accountDeletionRequestsTable).values({
    email: body.data.email.toLowerCase(),
    fullName: body.data.fullName ?? null,
    reason: body.data.reason ?? null,
    userId: linked?.id ?? null,
  }).returning({ id: accountDeletionRequestsTable.id });

  notifyAdmin("Nouvelle demande de suppression de compte", {
    intro: "Une demande de suppression de compte a été reçue.",
    rows: [
      { label: "Email", value: body.data.email.toLowerCase() },
      { label: "Nom", value: body.data.fullName ?? "—" },
      { label: "Motif", value: body.data.reason ?? "—" },
      { label: "Compte lié", value: linked?.id ? `#${linked.id}` : "aucun" },
    ],
  });

  res.status(201).json({ id: created.id, ok: true });
});

export default router;
