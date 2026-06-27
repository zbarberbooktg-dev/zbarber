import { Router } from "express";
import { db, reservationsTable, usersTable, barbersTable, servicesTable } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { requireAuthOrAdmin, type AdminAuthedRequest } from "../lib/adminAuth";

const router = Router();

async function enrichReservation(r: typeof reservationsTable.$inferSelect) {
  const [client] = await db.select({ name: usersTable.name, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, r.clientId)).limit(1);
  const [barber] = await db.select({ salonName: barbersTable.salonName, userId: barbersTable.userId }).from(barbersTable).where(eq(barbersTable.id, r.barberId)).limit(1);
  const [service] = await db.select({ name: servicesTable.name, price: servicesTable.price }).from(servicesTable).where(eq(servicesTable.id, r.serviceId)).limit(1);
  return { ...r, clientName: client?.name, clientPhone: client?.phone ?? null, barberName: barber?.salonName, serviceName: service?.name, servicePrice: service?.price };
}

router.get("/reservations", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const { page = "1", limit = "20", status, barberId, clientId, dateFrom, dateTo, search } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let rows = await db.select().from(reservationsTable).orderBy(desc(reservationsTable.createdAt));
  if (!req.admin) {
    const user = req.localUser!;
    if (user.role === "client") {
      rows = rows.filter(r => r.clientId === user.id);
    } else if (user.role === "barber") {
      // Salons are independent. Show reservations for the selected salon when a
      // (validated, owned) salonId is given; otherwise show every owned salon's
      // reservations — never collapse to the first salon only.
      const owned = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.userId, user.id));
      const ownedIds = owned.map(o => o.id);
      const rawSalon = (req.query as Record<string, string>).salonId;
      if (rawSalon !== undefined && rawSalon !== "") {
        const sid = parseInt(rawSalon);
        if (!Number.isFinite(sid) || !ownedIds.includes(sid)) { res.status(403).json({ error: "Salon not owned" }); return; }
        rows = rows.filter(r => r.barberId === sid);
      } else {
        rows = ownedIds.length ? rows.filter(r => ownedIds.includes(r.barberId)) : [];
      }
    }
  }
  // admin: see all
  if (status) rows = rows.filter(r => r.status === status);
  if (barberId) rows = rows.filter(r => r.barberId === parseInt(barberId));
  if (clientId) rows = rows.filter(r => r.clientId === parseInt(clientId));
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00.000Z`);
    rows = rows.filter(r => new Date(r.scheduledAt) >= from);
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59.999Z`);
    rows = rows.filter(r => new Date(r.scheduledAt) <= to);
  }
  let enriched = await Promise.all(rows.map(enrichReservation));
  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter(r =>
      (r.clientName?.toLowerCase().includes(q) ?? false) ||
      (r.barberName?.toLowerCase().includes(q) ?? false) ||
      (r.serviceName?.toLowerCase().includes(q) ?? false)
    );
  }
  const total = enriched.length;
  const data = enriched.slice(offset, offset + parseInt(limit));
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/reservations", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  // Any non-admin account can book like a client (a barber browses and books in
  // other salons exactly like a client). Admins manage, they do not book.
  if (user.role === "admin") { res.status(403).json({ error: "Admins cannot book" }); return; }
  const body = z.object({ barberId: z.number(), serviceId: z.number(), scheduledAt: z.string(), notes: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // Verify barber is approved
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, body.data.barberId)).limit(1);
  if (!b || b.status !== "approved") { res.status(400).json({ error: "Barber not available" }); return; }
  const [res2] = await db.insert(reservationsTable).values({ ...body.data, clientId: user.id, scheduledAt: new Date(body.data.scheduledAt) }).returning();
  res.status(201).json(await enrichReservation(res2));
});

router.get("/reservations/:id", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const [r] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, parseInt(String(req.params.id)))).limit(1);
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (!req.admin) {
    const user = req.localUser!;
    if (user.role === "client" && r.clientId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    if (user.role === "barber") {
      const owned = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.userId, user.id));
      if (!owned.some(o => o.id === r.barberId)) { res.status(403).json({ error: "Forbidden" }); return; }
    }
  }
  res.json(await enrichReservation(r));
});

router.patch("/reservations/:id", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [existing] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  // Admin path: any status.
  if (req.admin) {
    const body = z.object({ status: z.enum(["pending", "confirmed", "cancelled", "completed"]) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const [updated] = await db.update(reservationsTable).set({ status: body.data.status }).where(eq(reservationsTable.id, id)).returning();
    res.json(await enrichReservation(updated));
    return;
  }

  const user = req.localUser!;
  // Client can cancel their own. Barber can confirm/complete/cancel their own.
  if (user.role === "client" && existing.clientId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (user.role === "barber") {
    const owned = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.userId, user.id));
    if (!owned.some(o => o.id === existing.barberId)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  // Clients may only cancel their own reservation; barbers can set any status on their salon.
  const allowedStatuses = user.role === "client"
    ? (["cancelled"] as const)
    : (["pending", "confirmed", "cancelled", "completed"] as const);
  const body = z.object({ status: z.enum(allowedStatuses) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // Enforce 24h cancellation window for clients.
  if (user.role === "client" && body.data.status === "cancelled") {
    const scheduled = new Date(existing.scheduledAt).getTime();
    if (scheduled - Date.now() < 24 * 60 * 60 * 1000) {
      res.status(409).json({ error: "Cancellation window closed — less than 24h before appointment." });
      return;
    }
  }
  const [updated] = await db.update(reservationsTable).set({ status: body.data.status }).where(eq(reservationsTable.id, id)).returning();
  res.json(await enrichReservation(updated));
});

// silence unused import
void or;

export default router;
