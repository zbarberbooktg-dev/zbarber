import { Router } from "express";
import { db, barbersTable, usersTable, reviewsTable, reservationsTable, galleryPhotosTable, servicesTable, schedulesTable } from "@workspace/db";
import { eq, avg, count, ilike, or } from "drizzle-orm";
import { z } from "zod";

const router = Router();

async function barberWithDetails(id: number) {
  const [barber] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!barber) return null;
  const [user] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, barber.userId)).limit(1);
  const ratingRes = await db.select({ avg: avg(reviewsTable.rating), count: count() }).from(reviewsTable).where(eq(reviewsTable.barberId, id));
  return { ...barber, ownerName: user?.name, ownerEmail: user?.email, rating: ratingRes[0]?.avg ? parseFloat(ratingRes[0].avg) : 0, reviewCount: ratingRes[0]?.count ?? 0 };
}

router.get("/barbers", async (req, res) => {
  const { page = "1", limit = "20", search = "", status, city } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let rows = await db.select().from(barbersTable);
  if (search) rows = rows.filter(b => b.salonName.toLowerCase().includes(search.toLowerCase()) || b.city?.toLowerCase().includes(search.toLowerCase()));
  if (status) rows = rows.filter(b => b.status === status);
  if (city) rows = rows.filter(b => b.city === city);
  const enriched = await Promise.all(rows.map(async b => {
    const ratingRes = await db.select({ avg: avg(reviewsTable.rating), count: count() }).from(reviewsTable).where(eq(reviewsTable.barberId, b.id));
    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
    return { ...b, ownerName: user?.name, rating: ratingRes[0]?.avg ? parseFloat(ratingRes[0].avg) : 0, reviewCount: ratingRes[0]?.count ?? 0 };
  }));
  const total = enriched.length;
  res.json({ data: enriched.slice(offset, offset + parseInt(limit)), total, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/barbers", async (req, res) => {
  const body = z.object({ userId: z.number(), salonName: z.string(), bio: z.string().optional(), logoUrl: z.string().optional(), city: z.string(), neighborhood: z.string().optional(), address: z.string().optional(), phone: z.string().optional(), whatsapp: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [barber] = await db.insert(barbersTable).values(body.data).returning();
  res.status(201).json(barber);
});

router.get("/barbers/:id", async (req, res) => {
  const barber = await barberWithDetails(parseInt(req.params.id));
  if (!barber) return res.status(404).json({ error: "Barber not found" });
  res.json(barber);
});

router.patch("/barbers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ salonName: z.string().optional(), bio: z.string().optional(), logoUrl: z.string().optional(), city: z.string().optional(), neighborhood: z.string().optional(), address: z.string().optional(), phone: z.string().optional(), whatsapp: z.string().optional(), subscriptionPlanId: z.number().nullable().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [updated] = await db.update(barbersTable).set(body.data).where(eq(barbersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Barber not found" });
  res.json(updated);
});

router.post("/barbers/:id/approve", async (req, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(barbersTable).set({ status: "approved" }).where(eq(barbersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Barber not found" });
  res.json(updated);
});

router.post("/barbers/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(barbersTable).set({ status: "rejected" }).where(eq(barbersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Barber not found" });
  res.json(updated);
});

router.get("/barbers/:id/schedule", async (req, res) => {
  const id = parseInt(req.params.id);
  const schedule = await db.select().from(schedulesTable).where(eq(schedulesTable.barberId, id));
  res.json(schedule);
});

router.put("/barbers/:id/schedule", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.array(z.object({ day: z.string(), isWorking: z.boolean(), startTime: z.string().optional(), endTime: z.string().optional(), breakStart: z.string().optional(), breakEnd: z.string().optional() })).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  await db.delete(schedulesTable).where(eq(schedulesTable.barberId, id));
  if (body.data.length) await db.insert(schedulesTable).values(body.data.map(s => ({ ...s, barberId: id })));
  const schedule = await db.select().from(schedulesTable).where(eq(schedulesTable.barberId, id));
  res.json(schedule);
});

router.get("/barbers/:id/stats", async (req, res) => {
  const id = parseInt(req.params.id);
  const [barber] = await db.select({ profileViews: barbersTable.profileViews }).from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!barber) return res.status(404).json({ error: "Barber not found" });
  const totalRes = await db.select({ count: count() }).from(reservationsTable).where(eq(reservationsTable.barberId, id));
  const services = await db.select({ name: servicesTable.name, count: count() }).from(reservationsTable).leftJoin(servicesTable, eq(reservationsTable.serviceId, servicesTable.id)).where(eq(reservationsTable.barberId, id)).groupBy(servicesTable.name);
  res.json({ profileViews: barber.profileViews, totalClicks: barber.profileViews, monthlyReservations: Math.round((totalRes[0]?.count ?? 0) / 3), totalReservations: totalRes[0]?.count ?? 0, popularServices: services.slice(0, 5) });
});

router.get("/barbers/:id/gallery", async (req, res) => {
  const id = parseInt(req.params.id);
  const photos = await db.select().from(galleryPhotosTable).where(eq(galleryPhotosTable.barberId, id));
  res.json(photos);
});

router.post("/barbers/:id/gallery", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ photoUrl: z.string(), caption: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [photo] = await db.insert(galleryPhotosTable).values({ barberId: id, ...body.data }).returning();
  res.status(201).json(photo);
});

router.delete("/barbers/:barberId/gallery/:photoId", async (req, res) => {
  await db.delete(galleryPhotosTable).where(eq(galleryPhotosTable.id, parseInt(req.params.photoId)));
  res.status(204).send();
});

export default router;
