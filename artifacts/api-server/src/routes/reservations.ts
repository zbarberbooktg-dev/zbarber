import { Router } from "express";
import { db, reservationsTable, usersTable, barbersTable, servicesTable } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";

const router = Router();

async function enrichReservation(r: typeof reservationsTable.$inferSelect) {
  const [client] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.clientId)).limit(1);
  const [barber] = await db.select({ salonName: barbersTable.salonName, userId: barbersTable.userId }).from(barbersTable).where(eq(barbersTable.id, r.barberId)).limit(1);
  const [service] = await db.select({ name: servicesTable.name, price: servicesTable.price }).from(servicesTable).where(eq(servicesTable.id, r.serviceId)).limit(1);
  return { ...r, clientName: client?.name, barberName: barber?.salonName, serviceName: service?.name, servicePrice: service?.price };
}

router.get("/reservations", requireAuth, async (req: AuthedRequest, res) => {
  const { page = "1", limit = "20", status, barberId, clientId } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const user = req.localUser!;

  let rows = await db.select().from(reservationsTable).orderBy(desc(reservationsTable.createdAt));
  if (user.role === "client") {
    rows = rows.filter(r => r.clientId === user.id);
  } else if (user.role === "barber") {
    const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
    rows = b ? rows.filter(r => r.barberId === b.id) : [];
  }
  // admin: see all
  if (status) rows = rows.filter(r => r.status === status);
  if (barberId) rows = rows.filter(r => r.barberId === parseInt(barberId));
  if (clientId) rows = rows.filter(r => r.clientId === parseInt(clientId));
  const enriched = await Promise.all(rows.slice(offset, offset + parseInt(limit)).map(enrichReservation));
  res.json({ data: enriched, total: rows.length, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/reservations", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  if (user.role !== "client") { res.status(403).json({ error: "Only clients can book" }); return; }
  const body = z.object({ barberId: z.number(), serviceId: z.number(), scheduledAt: z.string(), notes: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // Verify barber is approved
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, body.data.barberId)).limit(1);
  if (!b || b.status !== "approved") { res.status(400).json({ error: "Barber not available" }); return; }
  const [res2] = await db.insert(reservationsTable).values({ ...body.data, clientId: user.id, scheduledAt: new Date(body.data.scheduledAt) }).returning();
  res.status(201).json(await enrichReservation(res2));
});

router.get("/reservations/:id", requireAuth, async (req: AuthedRequest, res) => {
  const [r] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, parseInt(String(req.params.id)))).limit(1);
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const user = req.localUser!;
  if (user.role === "client" && r.clientId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (user.role === "barber") {
    const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
    if (!b || r.barberId !== b.id) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  res.json(await enrichReservation(r));
});

router.patch("/reservations/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [existing] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const user = req.localUser!;
  // Client can cancel their own. Barber can confirm/complete/cancel their own. Admin all.
  if (user.role === "client" && existing.clientId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (user.role === "barber") {
    const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
    if (!b || existing.barberId !== b.id) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  // Clients may only cancel their own reservation; barbers/admins can set any status.
  const allowedStatuses = user.role === "client"
    ? (["cancelled"] as const)
    : (["pending", "confirmed", "cancelled", "completed"] as const);
  const body = z.object({ status: z.enum(allowedStatuses) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db.update(reservationsTable).set({ status: body.data.status }).where(eq(reservationsTable.id, id)).returning();
  res.json(await enrichReservation(updated));
});

// silence unused import
void or;

export default router;
