import { Router } from "express";
import { db, reservationsTable, usersTable, barbersTable, servicesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

async function enrichReservation(r: typeof reservationsTable.$inferSelect) {
  const [client] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.clientId)).limit(1);
  const [barber] = await db.select({ salonName: barbersTable.salonName }).from(barbersTable).where(eq(barbersTable.id, r.barberId)).limit(1);
  const [service] = await db.select({ name: servicesTable.name, price: servicesTable.price }).from(servicesTable).where(eq(servicesTable.id, r.serviceId)).limit(1);
  return { ...r, clientName: client?.name, barberName: barber?.salonName, serviceName: service?.name, servicePrice: service?.price };
}

router.get("/reservations", async (req, res) => {
  const { page = "1", limit = "20", status, barberId, clientId } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let rows = await db.select().from(reservationsTable).orderBy(desc(reservationsTable.createdAt));
  if (status) rows = rows.filter(r => r.status === status);
  if (barberId) rows = rows.filter(r => r.barberId === parseInt(barberId));
  if (clientId) rows = rows.filter(r => r.clientId === parseInt(clientId));
  const enriched = await Promise.all(rows.slice(offset, offset + parseInt(limit)).map(enrichReservation));
  res.json({ data: enriched, total: rows.length, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/reservations", async (req, res) => {
  const body = z.object({ clientId: z.number(), barberId: z.number(), serviceId: z.number(), scheduledAt: z.string(), notes: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [res2] = await db.insert(reservationsTable).values({ ...body.data, scheduledAt: new Date(body.data.scheduledAt) }).returning();
  res.status(201).json(await enrichReservation(res2));
});

router.get("/reservations/:id", async (req, res) => {
  const [r] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, parseInt(req.params.id))).limit(1);
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(await enrichReservation(r));
});

router.patch("/reservations/:id/status", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ status: z.enum(["pending", "confirmed", "cancelled", "completed"]) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [updated] = await db.update(reservationsTable).set({ status: body.data.status }).where(eq(reservationsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(await enrichReservation(updated));
});

export default router;
