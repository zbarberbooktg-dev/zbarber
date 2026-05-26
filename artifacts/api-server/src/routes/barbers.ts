import { Router } from "express";
import { db, barbersTable, usersTable, reviewsTable, reservationsTable, galleryPhotosTable, servicesTable, schedulesTable, financingRequestsTable } from "@workspace/db";
import { eq, avg, count, and, lt, inArray, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin, requireApprovedBarber, type AuthedRequest } from "../lib/clerkAuth";

const router = Router();

// Auto-archive: any reservation whose scheduled time is in the past and still
// "pending" or "confirmed" is marked "completed". Cutoff is `now` (UTC, same
// clock as DB timestamps) so it correctly handles slots earlier today as well.
// Called lazily on each barber-scoped read; cheap, idempotent, no cron needed.
async function archiveExpiredForBarber(barberId: number): Promise<void> {
  await db.update(reservationsTable)
    .set({ status: "completed" })
    .where(and(
      eq(reservationsTable.barberId, barberId),
      lt(reservationsTable.scheduledAt, new Date()),
      inArray(reservationsTable.status, ["pending", "confirmed"]),
    ));
}

async function getMyBarberOr404(req: AuthedRequest, res: import("express").Response) {
  if (req.localUser!.role !== "barber") { res.status(403).json({ error: "Barber account required" }); return null; }
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, req.localUser!.id)).limit(1);
  if (!b) { res.status(404).json({ error: "Salon profile not found" }); return null; }
  return b;
}

async function barberWithDetails(id: number) {
  const [barber] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!barber) return null;
  const [user] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, barber.userId)).limit(1);
  const ratingRes = await db.select({ avg: avg(reviewsTable.rating), count: count() }).from(reviewsTable).where(eq(reviewsTable.barberId, id));
  return { ...barber, ownerName: user?.name, ownerEmail: user?.email, rating: ratingRes[0]?.avg ? parseFloat(ratingRes[0].avg) : 0, reviewCount: ratingRes[0]?.count ?? 0 };
}

// ── Public: list approved barbers (for clients browsing) ───
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
  res.json({ data: enriched.slice(offset, offset + parseInt(limit)), total: enriched.length, page: parseInt(page), limit: parseInt(limit) });
});

// ── Barber: get my own profile (any status) ───
router.get("/barbers/me", requireAuth, async (req: AuthedRequest, res) => {
  if (req.localUser!.role !== "barber") { res.status(403).json({ error: "Barber account required" }); return; }
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, req.localUser!.id)).limit(1);
  if (!b) { res.json(null); return; }
  await archiveExpiredForBarber(b.id);
  res.json(await barberWithDetails(b.id));
});

// ── Barber: revenue dashboard (today / week / month / year / all) ───
router.get("/barbers/me/revenue", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  await archiveExpiredForBarber(b.id);

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1);
  // Week starts on Monday (locale convention for the target market).
  const startOfWeek = new Date(startOfToday);
  const dow = startOfToday.getDay(); // 0=Sun..6=Sat
  startOfWeek.setDate(startOfToday.getDate() - ((dow + 6) % 7));
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1);

  // Join reservations + services for price; only count "completed" as realized revenue.
  const rows = await db
    .select({
      scheduledAt: reservationsTable.scheduledAt,
      status: reservationsTable.status,
      price: servicesTable.price,
    })
    .from(reservationsTable)
    .leftJoin(servicesTable, eq(reservationsTable.serviceId, servicesTable.id))
    .where(eq(reservationsTable.barberId, b.id));

  const bucket = (from: Date, to?: Date) => {
    const subset = rows.filter(r => {
      const d = new Date(r.scheduledAt);
      if (d < from) return false;
      if (to && d >= to) return false;
      return true;
    });
    const completed = subset.filter(r => r.status === "completed");
    const upcoming = subset.filter(r => r.status === "pending" || r.status === "confirmed");
    const revenue = completed.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    return { revenue, completedCount: completed.length, upcomingCount: upcoming.length, totalCount: subset.length };
  };

  res.json({
    today: bucket(startOfToday, endOfToday),
    week: bucket(startOfWeek, endOfWeek),
    month: bucket(startOfMonth, endOfMonth),
    year: bucket(startOfYear, endOfYear),
    allTime: bucket(new Date(0)),
  });
});

// ── Barber: client list (unique clients who booked) ───
router.get("/barbers/me/clients", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  await archiveExpiredForBarber(b.id);

  const rows = await db
    .select({
      clientId: reservationsTable.clientId,
      scheduledAt: reservationsTable.scheduledAt,
      status: reservationsTable.status,
      price: servicesTable.price,
      name: usersTable.name,
      phone: usersTable.phone,
      email: usersTable.email,
    })
    .from(reservationsTable)
    .leftJoin(servicesTable, eq(reservationsTable.serviceId, servicesTable.id))
    .leftJoin(usersTable, eq(reservationsTable.clientId, usersTable.id))
    .where(eq(reservationsTable.barberId, b.id));

  const byClient = new Map<number, {
    clientId: number; name: string; phone: string | null; email: string;
    totalBookings: number; completedBookings: number; totalSpent: number;
    lastVisit: string | null;
  }>();
  for (const r of rows) {
    const cur = byClient.get(r.clientId) ?? {
      clientId: r.clientId,
      name: r.name ?? "Client",
      phone: r.phone ?? null,
      email: r.email ?? "",
      totalBookings: 0, completedBookings: 0, totalSpent: 0,
      lastVisit: null as string | null,
    };
    cur.totalBookings += 1;
    if (r.status === "completed") {
      cur.completedBookings += 1;
      cur.totalSpent += Number(r.price) || 0;
    }
    const d = new Date(r.scheduledAt).toISOString();
    if (!cur.lastVisit || d > cur.lastVisit) cur.lastVisit = d;
    byClient.set(r.clientId, cur);
  }
  const list = Array.from(byClient.values()).sort((a, b2) => (b2.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));
  res.json({ data: list, total: list.length });
});

// ── Barber: weekly working hours ───
router.get("/barbers/me/schedule", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const sched = await db.select().from(schedulesTable).where(eq(schedulesTable.barberId, b.id));
  res.json(sched);
});

router.put("/barbers/me/schedule", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const body = z.array(z.object({
    day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    isWorking: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    breakStart: z.string().optional(),
    breakEnd: z.string().optional(),
  })).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  await db.delete(schedulesTable).where(eq(schedulesTable.barberId, b.id));
  if (body.data.length) await db.insert(schedulesTable).values(body.data.map(s => ({ ...s, barberId: b.id })));
  const sched = await db.select().from(schedulesTable).where(eq(schedulesTable.barberId, b.id));
  res.json(sched);
});

// ── Barber: create salon profile (status starts pending) ───
router.post("/barbers/me", requireAuth, async (req: AuthedRequest, res) => {
  if (req.localUser!.role !== "barber") { res.status(403).json({ error: "Barber account required" }); return; }
  const body = z.object({
    salonName: z.string().min(2),
    bio: z.string().optional(),
    logoUrl: z.string().optional(),
    city: z.string().min(1),
    neighborhood: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [existing] = await db.select().from(barbersTable).where(eq(barbersTable.userId, req.localUser!.id)).limit(1);
  if (existing) { res.status(409).json({ error: "Profile already exists" }); return; }
  const [barber] = await db.insert(barbersTable).values({ ...body.data, userId: req.localUser!.id, status: "pending" }).returning();
  res.status(201).json(barber);
});

// ── Barber: update own profile ───
router.patch("/barbers/me", requireAuth, async (req: AuthedRequest, res) => {
  if (req.localUser!.role !== "barber") { res.status(403).json({ error: "Barber account required" }); return; }
  const body = z.object({
    salonName: z.string().optional(), bio: z.string().optional(), logoUrl: z.string().optional(),
    city: z.string().optional(), neighborhood: z.string().optional(), address: z.string().optional(),
    phone: z.string().optional(), whatsapp: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [existing] = await db.select().from(barbersTable).where(eq(barbersTable.userId, req.localUser!.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Profile not found" }); return; }
  const [updated] = await db.update(barbersTable).set(body.data).where(eq(barbersTable.id, existing.id)).returning();
  res.json(updated);
});

// ── Barber: submit financing request (only approved) ───
router.post("/barbers/me/financing", requireAuth, requireApprovedBarber, async (req: AuthedRequest & { barberId?: number }, res) => {
  const body = z.object({
    amount: z.number().positive(),
    purpose: z.enum(["renovation", "tools", "products", "other"]),
    description: z.string().min(5),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [created] = await db.insert(financingRequestsTable).values({ ...body.data, barberId: req.barberId! }).returning();
  res.status(201).json(created);
});

// ── Public: barber detail ───
router.get("/barbers/:id", async (req, res) => {
  const barber = await barberWithDetails(parseInt(String(req.params.id)));
  if (!barber) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(barber);
});

// ── Admin: full barber management ───
router.patch("/barbers/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ salonName: z.string().optional(), bio: z.string().optional(), logoUrl: z.string().optional(), city: z.string().optional(), neighborhood: z.string().optional(), address: z.string().optional(), phone: z.string().optional(), whatsapp: z.string().optional(), subscriptionPlanId: z.number().nullable().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db.update(barbersTable).set(body.data).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

router.patch("/barbers/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [updated] = await db.update(barbersTable).set({ status: "approved" }).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

router.patch("/barbers/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [updated] = await db.update(barbersTable).set({ status: "rejected" }).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

router.patch("/barbers/:id/suspend", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [updated] = await db.update(barbersTable).set({ status: "suspended" }).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

router.patch("/barbers/:id/reactivate", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [updated] = await db.update(barbersTable).set({ status: "approved" }).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

// ── Schedule (public read, barber-only write) ───
router.get("/barbers/:id/schedule", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const schedule = await db.select().from(schedulesTable).where(eq(schedulesTable.barberId, id));
  res.json(schedule);
});

router.put("/barbers/:id/schedule", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!b || (b.userId !== req.localUser!.id && req.localUser!.role !== "admin")) { res.status(403).json({ error: "Forbidden" }); return; }
  if (b.status !== "approved" && req.localUser!.role !== "admin") { res.status(403).json({ error: "Barber not approved" }); return; }
  const body = z.array(z.object({ day: z.string(), isWorking: z.boolean(), startTime: z.string().optional(), endTime: z.string().optional(), breakStart: z.string().optional(), breakEnd: z.string().optional() })).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  await db.delete(schedulesTable).where(eq(schedulesTable.barberId, id));
  if (body.data.length) await db.insert(schedulesTable).values(body.data.map(s => ({ ...s, barberId: id })));
  const schedule = await db.select().from(schedulesTable).where(eq(schedulesTable.barberId, id));
  res.json(schedule);
});

router.get("/barbers/:id/stats", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!b || (b.userId !== req.localUser!.id && req.localUser!.role !== "admin")) { res.status(403).json({ error: "Forbidden" }); return; }
  const [barber] = await db.select({ profileViews: barbersTable.profileViews }).from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!barber) { res.status(404).json({ error: "Barber not found" }); return; }
  const totalRes = await db.select({ count: count() }).from(reservationsTable).where(eq(reservationsTable.barberId, id));
  const services = await db.select({ name: servicesTable.name, count: count() }).from(reservationsTable).leftJoin(servicesTable, eq(reservationsTable.serviceId, servicesTable.id)).where(eq(reservationsTable.barberId, id)).groupBy(servicesTable.name);
  res.json({ profileViews: barber.profileViews, totalClicks: barber.profileViews, monthlyReservations: Math.round((totalRes[0]?.count ?? 0) / 3), totalReservations: totalRes[0]?.count ?? 0, popularServices: services.slice(0, 5) });
});

router.get("/barbers/:id/gallery", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const photos = await db.select().from(galleryPhotosTable).where(eq(galleryPhotosTable.barberId, id));
  res.json(photos);
});

router.post("/barbers/:id/gallery", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!b || (b.userId !== req.localUser!.id && req.localUser!.role !== "admin")) { res.status(403).json({ error: "Forbidden" }); return; }
  if (b.status !== "approved" && req.localUser!.role !== "admin") { res.status(403).json({ error: "Barber not approved" }); return; }
  const body = z.object({ photoUrl: z.string(), caption: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [photo] = await db.insert(galleryPhotosTable).values({ barberId: id, ...body.data }).returning();
  res.status(201).json(photo);
});

router.delete("/barbers/:barberId/gallery/:photoId", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.barberId));
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!b || (b.userId !== req.localUser!.id && req.localUser!.role !== "admin")) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(galleryPhotosTable).where(eq(galleryPhotosTable.id, parseInt(String(req.params.photoId))));
  res.status(204).send();
});

export default router;
