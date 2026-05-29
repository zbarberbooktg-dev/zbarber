import { Router } from "express";
import { db, barbersTable, usersTable, reviewsTable, reservationsTable, galleryPhotosTable, servicesTable, schedulesTable, daysOffTable, financingRequestsTable, loyaltyRedemptionsTable, serviceRealisationsTable, walkInQueueTable } from "@workspace/db";
import { eq, avg, count, and, lt, lte, gte, inArray, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireApprovedBarber, type AuthedRequest } from "../lib/clerkAuth";
import { requireAdminAuth } from "../lib/adminAuth";
import { resolveAndPersistLocation, UnknownCountryError } from "./locations";

const router = Router();

// Loyalty program: every LOYALTY_THRESHOLD completed cuts earns 1 free cut.
// A client is flagged "regular" once they reach REGULAR_THRESHOLD completed cuts.
const LOYALTY_THRESHOLD = 11;
const REGULAR_THRESHOLD = 5;

async function loyaltyFor(barberId: number, clientId: number) {
  const completedRes = await db.select({ c: count() }).from(reservationsTable)
    .where(and(
      eq(reservationsTable.barberId, barberId),
      eq(reservationsTable.clientId, clientId),
      eq(reservationsTable.status, "completed"),
    ));
  const redeemedRes = await db.select({ c: count() }).from(loyaltyRedemptionsTable)
    .where(and(
      eq(loyaltyRedemptionsTable.barberId, barberId),
      eq(loyaltyRedemptionsTable.clientId, clientId),
    ));
  const completed = Number(completedRes[0]?.c ?? 0);
  const redeemed = Number(redeemedRes[0]?.c ?? 0);
  const earned = Math.floor(completed / LOYALTY_THRESHOLD);
  const freeAvailable = Math.max(0, earned - redeemed);
  const untilNext = LOYALTY_THRESHOLD - (completed % LOYALTY_THRESHOLD);
  return {
    completed,
    threshold: LOYALTY_THRESHOLD,
    untilNext: untilNext === LOYALTY_THRESHOLD ? 0 : untilNext,
    freeAvailable,
    isRegular: completed >= REGULAR_THRESHOLD,
  };
}

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
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, barber.userId)).limit(1);
  const ratingRes = await db.select({ avg: avg(reviewsTable.rating), count: count() }).from(reviewsTable).where(eq(reviewsTable.barberId, id));
  return { ...barber, ownerName: user?.name, rating: ratingRes[0]?.avg ? parseFloat(ratingRes[0].avg) : 0, reviewCount: ratingRes[0]?.count ?? 0 };
}

// ── Public: list approved barbers (for clients browsing) ───
router.get("/barbers", async (req, res) => {
  const { page = "1", limit = "20", search = "", status, city, categoryId, service } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let rows = await db.select().from(barbersTable);
  if (search) rows = rows.filter(b => b.salonName.toLowerCase().includes(search.toLowerCase()) || b.city?.toLowerCase().includes(search.toLowerCase()));
  if (status) rows = rows.filter(b => b.status === status);
  if (city) rows = rows.filter(b => b.city === city);
  if (categoryId) {
    const catId = parseInt(categoryId);
    if (!Number.isNaN(catId)) {
      const svc = await db.select({ barberId: servicesTable.barberId }).from(servicesTable).where(eq(servicesTable.categoryId, catId));
      const ids = new Set(svc.map(s => s.barberId));
      rows = rows.filter(b => ids.has(b.id));
    }
  }
  if (service) {
    const q = service.toLowerCase();
    const svc = await db.select({ barberId: servicesTable.barberId, name: servicesTable.name }).from(servicesTable);
    const ids = new Set(svc.filter(s => s.name.toLowerCase().includes(q)).map(s => s.barberId));
    rows = rows.filter(b => ids.has(b.id));
  }
  const enriched = await Promise.all(rows.map(async b => {
    const ratingRes = await db.select({ avg: avg(reviewsTable.rating), count: count() }).from(reviewsTable).where(eq(reviewsTable.barberId, b.id));
    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
    return { ...b, ownerName: user?.name, rating: ratingRes[0]?.avg ? parseFloat(ratingRes[0].avg) : 0, reviewCount: ratingRes[0]?.count ?? 0 };
  }));
  res.json({ data: enriched.slice(offset, offset + parseInt(limit)), total: enriched.length, page: parseInt(page), limit: parseInt(limit) });
});

// ── Barber: get all my salons (array; barber can own multiple) ───
router.get("/barbers/me", requireAuth, async (req: AuthedRequest, res) => {
  if (req.localUser!.role !== "barber" && req.localUser!.role !== "admin") {
    res.status(403).json({ error: "Barber account required" }); return;
  }
  const rows = await db.select().from(barbersTable)
    .where(eq(barbersTable.userId, req.localUser!.id))
    .orderBy(barbersTable.id);
  if (rows.length === 0) { res.json([]); return; }
  // Archive expired for each owned salon
  await Promise.all(rows.map((b) => archiveExpiredForBarber(b.id)));
  const enriched = await Promise.all(rows.map((b) => barberWithDetails(b.id)));
  res.json(enriched.filter(Boolean));
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

// ── Barber: advanced stats (top services, peak hours/days, cancellation rate) ───
router.get("/barbers/me/stats/advanced", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  await archiveExpiredForBarber(b.id);

  const rows = await db
    .select({
      scheduledAt: reservationsTable.scheduledAt,
      status: reservationsTable.status,
      serviceId: reservationsTable.serviceId,
      serviceName: servicesTable.name,
      price: servicesTable.price,
    })
    .from(reservationsTable)
    .leftJoin(servicesTable, eq(reservationsTable.serviceId, servicesTable.id))
    .where(eq(reservationsTable.barberId, b.id));

  const completed = rows.filter((r) => r.status === "completed");
  const cancelledTotal = rows.filter((r) => r.status === "cancelled").length;
  // Cancellation rate over decided reservations (exclude still-pending/confirmed upcoming).
  const decided = completed.length + cancelledTotal;
  const cancellationRate = decided > 0 ? cancelledTotal / decided : 0;

  // Top services (by completed count).
  const svcMap = new Map<string, { serviceId: number | null; name: string; count: number; revenue: number }>();
  for (const r of completed) {
    const key = String(r.serviceId ?? "none");
    const cur = svcMap.get(key) ?? { serviceId: r.serviceId ?? null, name: r.serviceName ?? "Service supprimé", count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(r.price) || 0;
    svcMap.set(key, cur);
  }
  const topServices = Array.from(svcMap.values()).sort((a, b2) => b2.count - a.count).slice(0, 5);

  // Peak hours (0..23) and peak days (0=Mon..6=Sun) from completed reservations.
  const peakHours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const peakDays = Array.from({ length: 7 }, (_, day) => ({ day, count: 0 }));
  for (const r of completed) {
    const d = new Date(r.scheduledAt);
    peakHours[d.getHours()]!.count += 1;
    peakDays[(d.getDay() + 6) % 7]!.count += 1;
  }

  res.json({
    topServices,
    peakHours,
    peakDays,
    cancellationRate,
    noShowRate: 0,
    completedTotal: completed.length,
    cancelledTotal,
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
  // Enrich each client with loyalty info (regular badge + available free cuts).
  const redemptions = await db.select({ clientId: loyaltyRedemptionsTable.clientId })
    .from(loyaltyRedemptionsTable)
    .where(eq(loyaltyRedemptionsTable.barberId, b.id));
  const redeemedByClient = new Map<number, number>();
  for (const r of redemptions) redeemedByClient.set(r.clientId, (redeemedByClient.get(r.clientId) ?? 0) + 1);

  const list = Array.from(byClient.values())
    .map((cl) => {
      const earned = Math.floor(cl.completedBookings / LOYALTY_THRESHOLD);
      const freeCutsAvailable = Math.max(0, earned - (redeemedByClient.get(cl.clientId) ?? 0));
      return { ...cl, isRegular: cl.completedBookings >= REGULAR_THRESHOLD, freeCutsAvailable };
    })
    .sort((a, b2) => (b2.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));
  res.json({ data: list, total: list.length });
});

// ── Client: my loyalty status at a given salon ───
router.get("/barbers/:id/loyalty", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid barber id" }); return; }
  await archiveExpiredForBarber(id);
  res.json(await loyaltyFor(id, req.localUser!.id));
});

// ── Barber: redeem an available free cut for one of my clients ───
router.post("/barbers/me/loyalty/redeem", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const body = z.object({ clientId: z.number().int() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const status = await loyaltyFor(b.id, body.data.clientId);
  if (status.freeAvailable < 1) { res.status(409).json({ error: "No free cut available" }); return; }
  await db.insert(loyaltyRedemptionsTable).values({ barberId: b.id, clientId: body.data.clientId });
  res.status(201).json(await loyaltyFor(b.id, body.data.clientId));
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
  const user = req.localUser!;
  if (user.role === "admin") { res.status(403).json({ error: "Admins cannot own salons" }); return; }
  const body = z.object({
    salonName: z.string().min(2),
    bio: z.string().optional(),
    logoUrl: z.string().optional(),
    country: z.string().optional(),
    city: z.string().min(1),
    neighborhood: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  let resolved;
  try {
    resolved = await resolveAndPersistLocation({ countryName: body.data.country, cityName: body.data.city });
  } catch (e) {
    if (e instanceof UnknownCountryError) { res.status(400).json({ error: "Unknown country" }); return; }
    throw e;
  }
  const [barber] = await db.insert(barbersTable).values({
    ...body.data,
    country: resolved.country,
    city: resolved.city ?? body.data.city,
    userId: user.id,
    status: "pending",
  }).returning();
  // Auto-promote client → barber on first salon creation so they can manage it.
  if (user.role === "client") {
    await db.update(usersTable).set({ role: "barber" }).where(eq(usersTable.id, user.id));
  }
  res.status(201).json(barber);
});

// ── Barber: update own profile ───
router.patch("/barbers/me", requireAuth, async (req: AuthedRequest, res) => {
  if (req.localUser!.role !== "barber") { res.status(403).json({ error: "Barber account required" }); return; }
  const body = z.object({
    salonName: z.string().optional(), bio: z.string().optional(), logoUrl: z.string().optional(),
    country: z.string().optional(), city: z.string().optional(), neighborhood: z.string().optional(), address: z.string().optional(),
    phone: z.string().optional(), whatsapp: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [existing] = await db.select().from(barbersTable).where(eq(barbersTable.userId, req.localUser!.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Profile not found" }); return; }
  const patch: typeof body.data = { ...body.data };
  if (body.data.country !== undefined || body.data.city !== undefined) {
    try {
      const resolved = await resolveAndPersistLocation({
        countryName: body.data.country ?? existing.country,
        cityName: body.data.city ?? existing.city,
      });
      if (body.data.country !== undefined) patch.country = resolved.country ?? body.data.country;
      if (body.data.city !== undefined) patch.city = resolved.city ?? body.data.city;
    } catch (e) {
      if (e instanceof UnknownCountryError) { res.status(400).json({ error: "Unknown country" }); return; }
      throw e;
    }
  }
  const [updated] = await db.update(barbersTable).set(patch).where(eq(barbersTable.id, existing.id)).returning();
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

// ── Barber: days off (block whole days from client booking) ───
router.get("/barbers/me/days-off", requireAuth, requireApprovedBarber, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const rows = await db.select().from(daysOffTable).where(eq(daysOffTable.barberId, b.id)).orderBy(daysOffTable.date);
  res.json(rows);
});

router.post("/barbers/me/days-off", requireAuth, requireApprovedBarber, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const body = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    force: z.boolean().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid date (YYYY-MM-DD expected)" }); return; }
  // Idempotent: if already blocked, return existing.
  const [existing] = await db.select().from(daysOffTable)
    .where(and(eq(daysOffTable.barberId, b.id), eq(daysOffTable.date, body.data.date))).limit(1);
  if (existing) { res.status(200).json(existing); return; }
  // Guard: refuse to block a day that already has pending/confirmed reservations unless force=true.
  if (!body.data.force) {
    const dayStart = new Date(body.data.date + "T00:00:00Z");
    const dayEnd = new Date(dayStart); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const conflicts = await db.select({ id: reservationsTable.id })
      .from(reservationsTable)
      .where(and(
        eq(reservationsTable.barberId, b.id),
        gte(reservationsTable.scheduledAt, dayStart),
        lt(reservationsTable.scheduledAt, dayEnd),
        inArray(reservationsTable.status, ["pending", "confirmed"]),
      ));
    if (conflicts.length > 0) {
      res.status(409).json({ error: "conflicting_reservations", count: conflicts.length });
      return;
    }
  }
  const [created] = await db.insert(daysOffTable).values({ barberId: b.id, date: body.data.date }).returning();
  res.status(201).json(created);
});

router.delete("/barbers/me/days-off/:id", requireAuth, requireApprovedBarber, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Scope by both id AND barberId to prevent cross-barber deletion.
  await db.delete(daysOffTable).where(and(eq(daysOffTable.id, id), eq(daysOffTable.barberId, b.id)));
  res.status(204).send();
});

// ── Public: availability (dynamic slots based on weekly hours + service duration + bookings + days_off) ───
const DOW_KEYS: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
function parseHM(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1]!, 10), mm = parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}
function fmtHM(min: number): string {
  const h = Math.floor(min / 60), mm = min % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

router.get("/barbers/:id/availability", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid barber id" }); return; }
  const query = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    serviceId: z.string().optional(),
  }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "from/to required (YYYY-MM-DD)" }); return; }

  // Default slot step = 30 min; if serviceId provided, use its durationMinutes.
  let stepMinutes = 30;
  if (query.data.serviceId) {
    const sid = parseInt(query.data.serviceId);
    if (Number.isFinite(sid)) {
      const [svc] = await db.select({ d: servicesTable.durationMinutes }).from(servicesTable).where(eq(servicesTable.id, sid)).limit(1);
      if (svc?.d && svc.d > 0) stepMinutes = svc.d;
    }
  }

  const schedules = await db.select().from(schedulesTable).where(eq(schedulesTable.barberId, id));
  const scheduleByDay = new Map(schedules.map((s) => [s.day, s]));

  // Load reservations in [from 00:00 UTC, to+1 00:00 UTC) — pending or confirmed block the slot.
  // Using UTC boundaries to match the UTC-based slot iso generation below.
  const fromDate = new Date(query.data.from + "T00:00:00Z");
  const toDate = new Date(query.data.to + "T00:00:00Z"); toDate.setUTCDate(toDate.getUTCDate() + 1);
  const reservations = await db.select({ scheduledAt: reservationsTable.scheduledAt, status: reservationsTable.status })
    .from(reservationsTable)
    .where(and(
      eq(reservationsTable.barberId, id),
      gte(reservationsTable.scheduledAt, fromDate),
      lt(reservationsTable.scheduledAt, toDate),
      inArray(reservationsTable.status, ["pending", "confirmed"]),
    ));
  const bookedIso = new Set(reservations.map((r) => new Date(r.scheduledAt).toISOString()));

  // Load days off in the inclusive range.
  const offs = await db.select().from(daysOffTable)
    .where(and(
      eq(daysOffTable.barberId, id),
      gte(daysOffTable.date, query.data.from),
      lte(daysOffTable.date, query.data.to),
    ));
  const offSet = new Set(offs.map((o) => o.date));

  const now = new Date();
  const result: Array<{ date: string; isWorking: boolean; isBlocked: boolean; slots: Array<{ time: string; iso: string; available: boolean; reason?: string }> }> = [];

  for (const d = new Date(fromDate); d < toDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, "0"), day = String(d.getUTCDate()).padStart(2, "0");
    const ymd = `${y}-${m}-${day}`;
    const dowKey = DOW_KEYS[d.getUTCDay()]!;
    const sched = scheduleByDay.get(dowKey);
    const isBlocked = offSet.has(ymd);
    const isWorking = !!sched?.isWorking;

    if (!isWorking) { result.push({ date: ymd, isWorking: false, isBlocked, slots: [] }); continue; }
    if (isBlocked) { result.push({ date: ymd, isWorking: true, isBlocked: true, slots: [] }); continue; }

    const start = parseHM(sched!.startTime);
    const end = parseHM(sched!.endTime);
    if (start == null || end == null || end <= start) {
      result.push({ date: ymd, isWorking: true, isBlocked: false, slots: [] }); continue;
    }
    const breakStart = parseHM(sched!.breakStart);
    const breakEnd = parseHM(sched!.breakEnd);

    const slots: Array<{ time: string; iso: string; available: boolean; reason?: string }> = [];
    for (let t = start; t + stepMinutes <= end; t += stepMinutes) {
      const slotEnd = t + stepMinutes;
      // Skip slots overlapping the break.
      if (breakStart != null && breakEnd != null && t < breakEnd && slotEnd > breakStart) continue;
      // Generate the iso in UTC so it is identical regardless of server timezone.
      const slotDt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, t, 0, 0));
      const iso = slotDt.toISOString();
      let available = true; let reason: string | undefined;
      if (slotDt <= now) { available = false; reason = "past"; }
      else if (bookedIso.has(iso)) { available = false; reason = "booked"; }
      slots.push({ time: fmtHM(t), iso, available, reason });
    }
    result.push({ date: ymd, isWorking: true, isBlocked: false, slots });
  }

  res.json(result);
});

// ── Public: barber detail ───
router.get("/barbers/:id", async (req, res) => {
  const barber = await barberWithDetails(parseInt(String(req.params.id)));
  if (!barber) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(barber);
});

// ── Admin: full barber management ───
router.patch("/barbers/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ salonName: z.string().optional(), bio: z.string().optional(), logoUrl: z.string().optional(), city: z.string().optional(), neighborhood: z.string().optional(), address: z.string().optional(), phone: z.string().optional(), whatsapp: z.string().optional(), subscriptionPlanId: z.number().nullable().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db.update(barbersTable).set(body.data).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

router.patch("/barbers/:id/approve", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [updated] = await db.update(barbersTable).set({ status: "approved" }).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

router.patch("/barbers/:id/reject", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ reason: z.string().optional() }).safeParse(req.body ?? {});
  const reason = body.success ? body.data.reason?.trim() || null : null;
  const [updated] = await db.update(barbersTable).set({ status: "rejected", rejectionReason: reason }).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

router.patch("/barbers/:id/suspend", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ reason: z.string().optional() }).safeParse(req.body ?? {});
  const reason = body.success ? body.data.reason?.trim() || null : null;
  const [updated] = await db.update(barbersTable).set({ status: "suspended", suspensionReason: reason }).where(eq(barbersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Barber not found" }); return; }
  res.json(updated);
});

router.patch("/barbers/:id/reactivate", requireAdminAuth, async (req, res) => {
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
  const barberId = parseInt(String(req.params.barberId));
  const photoId = parseInt(String(req.params.photoId));
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, barberId)).limit(1);
  if (!b || (b.userId !== req.localUser!.id && req.localUser!.role !== "admin")) { res.status(403).json({ error: "Forbidden" }); return; }
  // Scope delete by both barberId AND photoId to prevent IDOR cross-barber deletion
  await db.delete(galleryPhotosTable).where(and(eq(galleryPhotosTable.id, photoId), eq(galleryPhotosTable.barberId, barberId)));
  res.status(204).send();
});

// ── REALISATIONS (before/after photos) ───
router.get("/barbers/me/realisations", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const rows = await db.select().from(serviceRealisationsTable)
    .where(eq(serviceRealisationsTable.barberId, b.id))
    .orderBy(desc(serviceRealisationsTable.createdAt));
  res.json(rows);
});

router.post("/barbers/me/realisations", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const body = z.object({
    beforeUrl: z.string(),
    afterUrl: z.string(),
    serviceId: z.number().int().nullish(),
    caption: z.string().nullish(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // If a service is given, make sure it belongs to this barber.
  if (body.data.serviceId != null) {
    const [svc] = await db.select({ id: servicesTable.id }).from(servicesTable)
      .where(and(eq(servicesTable.id, body.data.serviceId), eq(servicesTable.barberId, b.id))).limit(1);
    if (!svc) { res.status(400).json({ error: "Invalid service" }); return; }
  }
  const [row] = await db.insert(serviceRealisationsTable).values({ barberId: b.id, ...body.data }).returning();
  res.status(201).json(row);
});

router.delete("/barbers/me/realisations/:realisationId", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const realisationId = parseInt(String(req.params.realisationId));
  // Scope delete by both realisationId AND barberId to prevent IDOR.
  await db.delete(serviceRealisationsTable)
    .where(and(eq(serviceRealisationsTable.id, realisationId), eq(serviceRealisationsTable.barberId, b.id)));
  res.status(204).send();
});

router.get("/barbers/:id/realisations", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const rows = await db.select().from(serviceRealisationsTable)
    .where(eq(serviceRealisationsTable.barberId, id))
    .orderBy(desc(serviceRealisationsTable.createdAt));
  res.json(rows);
});

// ── WALK-IN QUEUE ──────────────────────────────────────────────────────
router.get("/barbers/me/queue", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const rows = await db.select().from(walkInQueueTable)
    .where(eq(walkInQueueTable.barberId, b.id))
    .orderBy(walkInQueueTable.position, walkInQueueTable.createdAt);
  res.json(rows);
});

router.post("/barbers/me/queue", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const body = z.object({
    clientName: z.string().min(1),
    clientPhone: z.string().nullish(),
    serviceId: z.number().int().nullish(),
    notes: z.string().nullish(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  if (body.data.serviceId != null) {
    const [svc] = await db.select({ id: servicesTable.id }).from(servicesTable)
      .where(and(eq(servicesTable.id, body.data.serviceId), eq(servicesTable.barberId, b.id))).limit(1);
    if (!svc) { res.status(400).json({ error: "Invalid service" }); return; }
  }
  // Append to the end of the queue.
  const [maxRow] = await db.select({ max: sql<number>`coalesce(max(${walkInQueueTable.position}), 0)` })
    .from(walkInQueueTable)
    .where(and(eq(walkInQueueTable.barberId, b.id), eq(walkInQueueTable.status, "waiting")));
  const nextPos = (maxRow?.max ?? 0) + 1;
  const [row] = await db.insert(walkInQueueTable).values({ barberId: b.id, position: nextPos, ...body.data }).returning();
  res.status(201).json(row);
});

router.patch("/barbers/me/queue/:entryId", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const entryId = parseInt(String(req.params.entryId));
  const body = z.object({ status: z.enum(["waiting", "in_progress", "done", "cancelled"]) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // Scope update by both entryId AND barberId to prevent IDOR.
  const [row] = await db.update(walkInQueueTable)
    .set({ status: body.data.status, updatedAt: new Date() })
    .where(and(eq(walkInQueueTable.id, entryId), eq(walkInQueueTable.barberId, b.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/barbers/me/queue/:entryId", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const entryId = parseInt(String(req.params.entryId));
  // Scope delete by both entryId AND barberId to prevent IDOR.
  await db.delete(walkInQueueTable)
    .where(and(eq(walkInQueueTable.id, entryId), eq(walkInQueueTable.barberId, b.id)));
  res.status(204).send();
});

export default router;
