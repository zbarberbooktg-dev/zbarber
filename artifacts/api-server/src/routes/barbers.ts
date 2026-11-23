import { Router, type Request, type Response } from "express";
import { db, barbersTable, usersTable, reviewsTable, reservationsTable, galleryPhotosTable, servicesTable, schedulesTable, daysOffTable, financingRequestsTable, loyaltyRedemptionsTable, serviceRealisationsTable, walkInQueueTable, panoramasTable, objectUploadsTable, homeServiceHoursTable, homeServiceZonesTable } from "@workspace/db";
import { eq, avg, count, and, or, ilike, lt, lte, gte, inArray, sql, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireApprovedBarber, type AuthedRequest } from "../lib/clerkAuth";
import { requireAdminAuth, resolveAdminFromCookie } from "../lib/adminAuth";
import { anonymizeUserAccount } from "../lib/accountAnonymize";
import { resolveAndPersistLocation, UnknownCountryError } from "./locations";
import { notifyAdmin, renderEmail, sendEmail } from "../lib/email";
import { sendPush } from "../lib/push";
import { haversineKm, matchZone } from "../lib/geo";

const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// Load a barber's full at-home service config (weekly hours + fee zones) plus the
// salon's stored coordinates. Hours are normalised to all 7 days for the UI.
async function loadHomeServiceConfig(barber: typeof barbersTable.$inferSelect) {
  const [hoursRows, zones] = await Promise.all([
    db.select().from(homeServiceHoursTable).where(eq(homeServiceHoursTable.barberId, barber.id)),
    db.select().from(homeServiceZonesTable).where(eq(homeServiceZonesTable.barberId, barber.id)).orderBy(homeServiceZonesTable.maxRadiusKm),
  ]);
  const byDay = new Map(hoursRows.map((h) => [h.day, h]));
  const hours = WEEK_DAYS.map((day) => {
    const h = byDay.get(day);
    return {
      day,
      isAvailable: h?.isAvailable ?? false,
      startTime: h?.startTime ?? null,
      endTime: h?.endTime ?? null,
    };
  });
  return {
    enabled: barber.homeServiceEnabled,
    latitude: barber.latitude,
    longitude: barber.longitude,
    hours,
    zones: zones.map((z) => ({ id: z.id, maxRadiusKm: z.maxRadiusKm, fee: z.fee })),
  };
}

const router = Router();

// Send a branded lifecycle email to a barber. Fire-and-forget: never throws so
// it can't break the originating admin/barber request.
function notifyBarberEmail(
  to: string | null | undefined,
  subject: string,
  content: { heading: string; intro?: string; paragraphs?: string[]; button?: { label: string; url: string }; note?: string },
): void {
  if (!to) return;
  const { html, text } = renderEmail({ title: `[Zbarber] ${subject}`, ...content });
  void sendEmail({ to, subject: `[Zbarber] ${subject}`, html, text }).catch(() => { /* logged in sendEmail */ });
}

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

// Resolve the barber's working salon for a self-service (`/barbers/me/*`) request.
// Salons are fully independent entities: an owner with multiple salons must be
// able to target a specific one via the `salonId` query param. We always verify
// the requested salon is owned by the caller (ownership authorization) before
// returning it. When no `salonId` is given we default to the first salon (by id)
// for backward compatibility with single-salon callers.
// Resolves the caller's own salon (primary, or ?salonId when provided).
// Full barber features require human salon approval, never a document.
// Only the optional-document route may opt in to pending-owner access.
async function getMyBarberOr404(
  req: AuthedRequest,
  res: import("express").Response,
  opts: { allowOptionalDocument?: boolean } = {},
) {
  if (req.localUser!.role !== "barber" && !opts.allowOptionalDocument) { res.status(403).json({ error: "Barber account required" }); return null; }
  const salons = await db.select().from(barbersTable)
    .where(eq(barbersTable.userId, req.localUser!.id))
    .orderBy(barbersTable.id);
  if (salons.length === 0) { res.status(404).json({ error: "Salon profile not found" }); return null; }
  const raw = req.query.salonId;
  let salon = salons[0]!;
  if (raw !== undefined && raw !== "") {
    const sid = parseInt(String(raw));
    if (!Number.isFinite(sid)) { res.status(400).json({ error: "Invalid salonId" }); return null; }
    const match = salons.find((s) => s.id === sid);
    if (!match) { res.status(403).json({ error: "Salon not owned" }); return null; }
    salon = match;
  }
  const allowed = salon.status === "approved"
    || (opts.allowOptionalDocument === true && (salon.status === "awaiting_document" || salon.status === "pending"));
  if (!allowed) { res.status(403).json({ error: "Barber not approved", status: salon.status }); return null; }
  return salon;
}

// Return the ids of every salon owned by the caller (for cross-salon ownership
// checks where a self-service helper isn't used).
async function ownedSalonIds(userId: number): Promise<number[]> {
  const rows = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.userId, userId));
  return rows.map((r) => r.id);
}

async function barberWithDetails(id: number) {
  const [barber] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!barber) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, barber.userId)).limit(1);
  const ratingRes = await db.select({ avg: avg(reviewsTable.rating), count: count() }).from(reviewsTable).where(eq(reviewsTable.barberId, id));
  return { ...barber, ownerName: user?.name, rating: ratingRes[0]?.avg ? parseFloat(ratingRes[0].avg) : 0, reviewCount: ratingRes[0]?.count ?? 0 };
}

// Enrich only the requested page. Gallery selection is stable and batched, not
// one extra request (or database query) for every card on the home screen.
async function withCardDetails(rows: Array<typeof barbersTable.$inferSelect>) {
  if (!rows.length) return [];
  const ids = rows.map((b) => b.id);
  const [photos, ratings, owners] = await Promise.all([
    db.select().from(galleryPhotosTable).where(inArray(galleryPhotosTable.barberId, ids))
      .orderBy(asc(galleryPhotosTable.createdAt), asc(galleryPhotosTable.id)),
    db.select({ barberId: reviewsTable.barberId, rating: avg(reviewsTable.rating), count: count() })
      .from(reviewsTable).where(inArray(reviewsTable.barberId, ids)).groupBy(reviewsTable.barberId),
    db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
      .where(inArray(usersTable.id, rows.map((b) => b.userId))),
  ]);
  const firstPhotos = new Map<number, string>();
  for (const p of photos) if (!firstPhotos.has(p.barberId)) firstPhotos.set(p.barberId, p.photoUrl);
  const byRating = new Map(ratings.map((r) => [r.barberId, r]));
  const byOwner = new Map(owners.map((u) => [u.id, u.name]));
  return rows.map((b) => ({
    ...b, cardImageUrl: b.logoUrl || firstPhotos.get(b.id) || null,
    ownerName: byOwner.get(b.userId),
    rating: Number(byRating.get(b.id)?.rating ?? 0),
    reviewCount: byRating.get(b.id)?.count ?? 0,
  }));
}

// ── Public: list approved barbers (for clients browsing) ───
const optionalNumber = (min: number, max: number) => z.string().trim().min(1).pipe(z.coerce.number().min(min).max(max)).optional();

router.get("/barbers", async (req, res) => {
  const input = z.object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).default(""),
    status: z.enum(["pending", "awaiting_document", "approved", "rejected", "suspended"]).optional(),
    city: z.string().trim().max(200).optional(), country: z.string().trim().max(200).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    minPrice: optionalNumber(0, Number.MAX_SAFE_INTEGER), maxPrice: optionalNumber(0, Number.MAX_SAFE_INTEGER),
    latitude: optionalNumber(-90, 90), longitude: optionalNumber(-180, 180), radiusKm: optionalNumber(0.1, 500),
    service: z.string().max(200).optional(), sort: z.enum(["newest"]).optional(),
  }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: "Invalid search parameters" }); return; }
  const q = input.data;
  const usesDistance = q.radiusKm !== undefined || q.latitude !== undefined || q.longitude !== undefined;
  if ((usesDistance && (q.radiusKm === undefined || q.latitude === undefined || q.longitude === undefined)) ||
    (q.minPrice !== undefined && q.maxPrice !== undefined && q.minPrice > q.maxPrice)) {
    res.status(400).json({ error: "Invalid distance or price range" }); return;
  }
  // Public callers cannot enumerate unapproved salons by changing a query param.
  const admin = await resolveAdminFromCookie(req);
  if (!admin && q.status && q.status !== "approved") {
    res.status(403).json({ error: "Admin access required for non-public salons" }); return;
  }
  const conditions = [];
  if (!admin || q.status) conditions.push(eq(barbersTable.status, q.status ?? "approved"));
  const pattern = (v: string) => `%${v.replace(/[\\%_]/g, "\\$&")}%`;
  if (q.search) conditions.push(or(
    ilike(barbersTable.salonName, pattern(q.search)),
    ilike(barbersTable.city, pattern(q.search)),
    ilike(barbersTable.neighborhood, pattern(q.search)),
  )!);
  if (q.city) conditions.push(eq(barbersTable.city, q.city));
  if (q.country) conditions.push(eq(barbersTable.country, q.country));
  const byPrice = q.minPrice !== undefined || q.maxPrice !== undefined;
  if (q.categoryId || q.service || byPrice) {
    const services = db.select({ id: servicesTable.barberId }).from(servicesTable).where(and(
      q.categoryId ? eq(servicesTable.categoryId, q.categoryId) : undefined,
      q.service ? ilike(servicesTable.name, pattern(q.service)) : undefined,
      byPrice ? eq(servicesTable.isActive, true) : undefined,
      q.minPrice === undefined ? undefined : gte(servicesTable.price, q.minPrice),
      q.maxPrice === undefined ? undefined : lte(servicesTable.price, q.maxPrice),
    ));
    conditions.push(inArray(barbersTable.id, services));
  }
  const distance = q.radiusKm === undefined ? undefined : sql<number>`12742 * asin(sqrt(least(1,
    power(sin(radians(${barbersTable.latitude} - ${q.latitude}::double precision) / 2), 2) +
    cos(radians(${q.latitude}::double precision)) * cos(radians(${barbersTable.latitude})) *
      power(sin(radians(${barbersTable.longitude} - ${q.longitude}::double precision) / 2), 2)
  )))`;
  if (distance && q.radiusKm !== undefined) {
    conditions.push(
      gte(barbersTable.latitude, -90), lte(barbersTable.latitude, 90),
      gte(barbersTable.longitude, -180), lte(barbersTable.longitude, 180),
      sql`${distance} <= ${q.radiusKm}`,
    );
  }
  const where = and(...conditions);
  const [totals, rows] = await Promise.all([
    db.select({ total: count() }).from(barbersTable).where(where),
    db.select().from(barbersTable).where(where)
      .orderBy(...(distance ? [asc(distance), asc(barbersTable.id)] :
        q.sort === "newest" ? [desc(barbersTable.createdAt), desc(barbersTable.id)] : [asc(barbersTable.id)]))
      .limit(q.limit).offset((q.page - 1) * q.limit),
  ]);
  res.json({ data: await withCardDetails(rows), total: totals[0]?.total ?? 0, page: q.page, limit: q.limit });
});

router.get("/barbers/catalog-locations", async (_req, res) => {
  const rows = await db.selectDistinct({ country: barbersTable.country, city: barbersTable.city })
    .from(barbersTable).where(eq(barbersTable.status, "approved"))
    .orderBy(asc(barbersTable.country), asc(barbersTable.city));
  res.json(rows);
});

router.get("/barbers/map-points", async (req, res) => {
  const input = z.object({ categoryId: z.coerce.number().int().positive().optional() }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: "Invalid category" }); return; }
  const rows = await db.select({
    id: barbersTable.id, salonName: barbersTable.salonName, city: barbersTable.city,
    neighborhood: barbersTable.neighborhood, latitude: barbersTable.latitude, longitude: barbersTable.longitude,
    rating: sql<number>`coalesce((select avg(rating) from ${reviewsTable} where ${reviewsTable.barberId} = ${barbersTable.id}), 0)`.mapWith(Number),
  }).from(barbersTable).where(and(
    eq(barbersTable.status, "approved"),
    gte(barbersTable.latitude, -90), lte(barbersTable.latitude, 90),
    gte(barbersTable.longitude, -180), lte(barbersTable.longitude, 180),
    input.data.categoryId ? inArray(barbersTable.id, db.select({ id: servicesTable.barberId })
      .from(servicesTable).where(eq(servicesTable.categoryId, input.data.categoryId))) : undefined,
  )).orderBy(asc(barbersTable.id));
  res.json(rows);
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

// ── Barber: at-home ("à domicile") service configuration ───
router.get("/barbers/me/home-service", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  res.json(await loadHomeServiceConfig(b));
});

router.put("/barbers/me/home-service", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const body = z.object({
    enabled: z.boolean(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    hours: z.array(z.object({
      day: z.enum(WEEK_DAYS),
      isAvailable: z.boolean(),
      startTime: z.string().optional().nullable(),
      endTime: z.string().optional().nullable(),
    })).optional(),
    zones: z.array(z.object({
      maxRadiusKm: z.number().positive(),
      fee: z.number().min(0),
    })).optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  // Enabling the service requires salon coordinates (stored or provided now) so
  // distance/fee can be computed for clients.
  const nextLat = body.data.latitude ?? b.latitude;
  const nextLng = body.data.longitude ?? b.longitude;
  if (body.data.enabled && (nextLat == null || nextLng == null)) {
    res.status(400).json({ error: "Salon location (GPS) is required to enable the home service" });
    return;
  }

  // Enabling the service requires at least one distance zone (stored or provided
  // now) so a travel fee can always be quoted to clients. Zones sent in this
  // request take precedence; otherwise fall back to what's already stored.
  let effectiveZoneCount: number;
  if (body.data.zones !== undefined) {
    effectiveZoneCount = body.data.zones.length;
  } else {
    const existing = await db.select().from(homeServiceZonesTable).where(eq(homeServiceZonesTable.barberId, b.id));
    effectiveZoneCount = existing.length;
  }
  if (body.data.enabled && effectiveZoneCount === 0) {
    res.status(400).json({ error: "At least one distance zone is required to enable the home service" });
    return;
  }

  await db.update(barbersTable).set({
    homeServiceEnabled: body.data.enabled,
    ...(body.data.latitude !== undefined ? { latitude: body.data.latitude } : {}),
    ...(body.data.longitude !== undefined ? { longitude: body.data.longitude } : {}),
  }).where(eq(barbersTable.id, b.id));

  if (body.data.hours) {
    await db.delete(homeServiceHoursTable).where(eq(homeServiceHoursTable.barberId, b.id));
    const rows = body.data.hours.map((h) => ({
      barberId: b.id,
      day: h.day,
      isAvailable: h.isAvailable,
      startTime: h.isAvailable ? (h.startTime ?? null) : null,
      endTime: h.isAvailable ? (h.endTime ?? null) : null,
    }));
    if (rows.length) await db.insert(homeServiceHoursTable).values(rows);
  }
  if (body.data.zones) {
    await db.delete(homeServiceZonesTable).where(eq(homeServiceZonesTable.barberId, b.id));
    if (body.data.zones.length) {
      await db.insert(homeServiceZonesTable).values(body.data.zones.map((z2) => ({ barberId: b.id, maxRadiusKm: z2.maxRadiusKm, fee: z2.fee })));
    }
  }
  const [fresh] = await db.select().from(barbersTable).where(eq(barbersTable.id, b.id)).limit(1);
  res.json(await loadHomeServiceConfig(fresh!));
});

// ── Barber: create salon profile (status starts pending) ───
router.post("/barbers/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  if (user.role === "admin") { res.status(403).json({ error: "Admins cannot own salons" }); return; }
  const body = z.object({
    salonName: z.string().min(2),
    bio: z.string().optional(),
    logoUrl: z.string().nullable().optional(),
    country: z.string().optional(),
    city: z.string().min(1),
    neighborhood: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    latitude: z.number().finite().min(-90).max(90).nullable().optional(),
    longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  }).refine((v) => (v.latitude == null) === (v.longitude == null), "Coordinates must be supplied together").safeParse(req.body);
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
  // The account stays a "client" until an admin validates the salon. Barber
  // capabilities are NOT self-granted on creation — role is flipped to "barber"
  // only by the admin approval endpoint.
  notifyAdmin("Nouvelle inscription barbier à valider", {
    intro: "Un nouveau salon est en attente de validation.",
    rows: [
      { label: "Salon", value: barber.salonName },
      { label: "Ville", value: barber.city ?? "—" },
      { label: "Pays", value: barber.country ?? "—" },
      { label: "Demandeur", value: user.name ?? user.email ?? `#${user.id}` },
    ],
  });
  res.status(201).json(barber);
});

// ── Barber: update own profile ───
router.patch("/barbers/me", requireAuth, async (req: AuthedRequest, res) => {
  if (req.localUser!.role !== "barber") { res.status(403).json({ error: "Barber account required" }); return; }
  const query = z.object({ salonId: z.coerce.number().int().positive().optional() }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid salonId" }); return; }
  const body = z.object({
    salonName: z.string().optional(), bio: z.string().optional(), logoUrl: z.string().nullable().optional(),
    country: z.string().optional(), city: z.string().optional(), neighborhood: z.string().optional(), address: z.string().optional(),
    phone: z.string().optional(), whatsapp: z.string().optional(),
    latitude: z.number().finite().min(-90).max(90).nullable().optional(),
    longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  }).refine((v) => (v.latitude === undefined && v.longitude === undefined)
    || (v.latitude === null && v.longitude === null)
    || (typeof v.latitude === "number" && typeof v.longitude === "number"), "Coordinates must be supplied together").safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [existing] = await db.select().from(barbersTable).where(and(
    eq(barbersTable.userId, req.localUser!.id),
    query.data.salonId !== undefined ? eq(barbersTable.id, query.data.salonId) : undefined,
  )).orderBy(asc(barbersTable.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Profile not found" }); return; }
  if (existing.homeServiceEnabled && body.data.latitude === null) {
    res.status(400).json({ error: "Disable home service before removing salon coordinates" }); return;
  }
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

// ── Owner: submit an optional private professional document ───
router.post("/barbers/me/document", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res, { allowOptionalDocument: true });
  if (!b) return;
  const body = z.object({
    documentUrl: z.string().min(1).refine((v) => v.startsWith("/objects/"), "Invalid document path"),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // Anti path-claiming: the submitted object path must have been uploaded by
  // this user. Otherwise a barber could claim another user's private financing
  // ID-document path as their own documentUrl and read that PII via the
  // reference-based storage ACL.
  const [upload] = await db
    .select({ userId: objectUploadsTable.userId })
    .from(objectUploadsTable)
    .where(eq(objectUploadsTable.objectPath, body.data.documentUrl))
    .limit(1);
  if (!upload || upload.userId !== req.localUser!.id) {
    res.status(400).json({ error: "Invalid document path" });
    return;
  }
  const [updated] = await db.update(barbersTable).set({
    documentUrl: body.data.documentUrl,
    documentSubmittedAt: new Date(),
    documentReviewNote: null,
  }).where(and(eq(barbersTable.id, b.id), inArray(barbersTable.status, ["pending", "awaiting_document", "approved"]))).returning();
  if (!updated) { res.status(409).json({ error: "Salon status changed; refresh before retrying" }); return; }
  notifyAdmin("Document facultatif du salon", {
    intro: `Le salon « ${updated!.salonName} » a transmis un document professionnel facultatif.`,
    rows: [
      { label: "Salon", value: updated!.salonName },
      { label: "Ville", value: updated!.city ?? "—" },
      { label: "Salon #", value: String(updated!.id) },
    ],
    note: "Ce document est privé et facultatif. Son examen ne conditionne pas l'approbation du salon.",
  });
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
  notifyAdmin("Nouvelle demande de financement", {
    intro: `Une demande de financement a été soumise (salon #${req.barberId}).`,
    rows: [
      { label: "Montant", value: `${body.data.amount} FC` },
      { label: "Objet", value: body.data.purpose },
      { label: "Description", value: body.data.description },
    ],
  });
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
    mode: z.enum(["salon", "home"]).optional(),
  }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "from/to required (YYYY-MM-DD)" }); return; }
  const mode = query.data.mode ?? "salon";

  // Default slot step = 30 min; if serviceId provided, use its durationMinutes.
  let stepMinutes = 30;
  if (query.data.serviceId) {
    const sid = parseInt(query.data.serviceId);
    if (Number.isFinite(sid)) {
      const [svc] = await db.select({ d: servicesTable.durationMinutes }).from(servicesTable).where(and(eq(servicesTable.id, sid), eq(servicesTable.barberId, id))).limit(1);
      if (svc?.d && svc.d > 0) stepMinutes = svc.d;
    }
  }

  // Slot windows come from the salon weekly hours by default, or the separate
  // home-service weekly hours when mode=home. Both are normalised to a common
  // shape (home hours have no break, so break fields are null).
  type DayWindow = { isWorking: boolean; startTime: string | null; endTime: string | null; breakStart: string | null; breakEnd: string | null };
  const scheduleByDay = new Map<string, DayWindow>();
  if (mode === "home") {
    const hs = await db.select().from(homeServiceHoursTable).where(eq(homeServiceHoursTable.barberId, id));
    for (const h of hs) scheduleByDay.set(h.day, { isWorking: h.isAvailable, startTime: h.startTime, endTime: h.endTime, breakStart: null, breakEnd: null });
  } else {
    const schedules = await db.select().from(schedulesTable).where(eq(schedulesTable.barberId, id));
    for (const s of schedules) scheduleByDay.set(s.day, { isWorking: s.isWorking, startTime: s.startTime, endTime: s.endTime, breakStart: s.breakStart, breakEnd: s.breakEnd });
  }

  // Load reservations in [from 00:00 UTC, to+1 00:00 UTC) — pending or confirmed block the slot.
  // Using UTC boundaries to match the UTC-based slot iso generation below.
  const fromDate = new Date(query.data.from + "T00:00:00Z");
  const toDate = new Date(query.data.to + "T00:00:00Z"); toDate.setUTCDate(toDate.getUTCDate() + 1);
  // Pull each active reservation together with its service duration so we can
  // treat it as a time *range*, not just a start instant. A 60-min 09:00 booking
  // must block the 09:30 slot of a 30-min service, even though the starts differ.
  // We widen the lower bound by the longest possible service so a booking that
  // *starts* before `fromDate` but bleeds into it still counts.
  const longestDuration = await db.select({ max: sql<number>`coalesce(max(${servicesTable.durationMinutes}), 0)` })
    .from(servicesTable).where(eq(servicesTable.barberId, id));
  const maxDur = longestDuration[0]?.max ?? 0;
  const loadFrom = new Date(fromDate.getTime() - Math.max(maxDur, 0) * 60_000);
  const reservations = await db.select({ scheduledAt: reservationsTable.scheduledAt, durationMinutes: servicesTable.durationMinutes })
    .from(reservationsTable)
    .innerJoin(servicesTable, eq(servicesTable.id, reservationsTable.serviceId))
    .where(and(
      eq(reservationsTable.barberId, id),
      gte(reservationsTable.scheduledAt, loadFrom),
      lt(reservationsTable.scheduledAt, toDate),
      inArray(reservationsTable.status, ["pending", "confirmed"]),
    ));
  // Precompute each booking's absolute [startMs, endMs) range once.
  const bookedRanges = reservations.map((r) => {
    const startMs = new Date(r.scheduledAt).getTime();
    const dur = r.durationMinutes && r.durationMinutes > 0 ? r.durationMinutes : 30;
    return { startMs, endMs: startMs + dur * 60_000 };
  });

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
      // This slot's own range [start, start + stepMinutes) for overlap testing.
      const slotStartMs = slotDt.getTime();
      const slotEndMs = slotStartMs + stepMinutes * 60_000;
      let available = true; let reason: string | undefined;
      if (slotDt <= now) { available = false; reason = "past"; }
      // Unavailable if this slot's range intersects any active booking's range,
      // not only when the start instants match. A longer existing booking thus
      // blocks every slot it spans.
      else if (bookedRanges.some((b) => b.startMs < slotEndMs && b.endMs > slotStartMs)) { available = false; reason = "booked"; }
      slots.push({ time: fmtHM(t), iso, available, reason });
    }
    result.push({ date: ymd, isWorking: true, isBlocked: false, slots });
  }

  res.json(result);
});

// ── Public: at-home service info for a salon (hours + fee zones) ───
// Lets a client see the barber's home-visit availability and pricing tiers.
router.get("/barbers/:id/home-service", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid barber id" }); return; }
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!b) { res.status(404).json({ error: "Barber not found" }); return; }
  const cfg = await loadHomeServiceConfig(b);
  // Don't leak the salon's precise coordinates to the public; expose only what a
  // client needs to browse (enabled flag, hours, and the fee zones).
  res.json({ enabled: cfg.enabled, hours: cfg.hours, zones: cfg.zones });
});

// ── Client: quote the travel fee for a home visit at a given GPS location ───
router.post("/barbers/:id/home-service/quote", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid barber id" }); return; }
  const body = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid location" }); return; }
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!b) { res.status(404).json({ error: "Barber not found" }); return; }
  if (!b.homeServiceEnabled || b.latitude == null || b.longitude == null) {
    res.status(400).json({ error: "Home service not available for this salon" });
    return;
  }
  const zones = await db.select().from(homeServiceZonesTable).where(eq(homeServiceZonesTable.barberId, id));
  const distanceKm = haversineKm(b.latitude, b.longitude, body.data.latitude, body.data.longitude);
  const zone = matchZone(zones.map((z2) => ({ maxRadiusKm: z2.maxRadiusKm, fee: z2.fee })), distanceKm);
  res.json({
    inRange: zone != null,
    distanceKm: Math.round(distanceKm * 100) / 100,
    fee: zone?.fee ?? null,
    maxRadiusKm: zone?.maxRadiusKm ?? null,
  });
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

// Human approval remains mandatory. Both pending states can be approved without
// a document; the legacy first-validate action is an alias for old admin clients.
async function approveSalon(req: Request, res: Response) {
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid barber id" }); return; }
  const updated = await db.transaction(async (tx) => {
    const [salon] = await tx.update(barbersTable).set({
      status: "approved",
      firstValidatedAt: sql`coalesce(${barbersTable.firstValidatedAt}, now())`,
      rejectionReason: null,
    }).where(and(eq(barbersTable.id, id), inArray(barbersTable.status, ["pending", "awaiting_document"]))).returning();
    if (salon) {
      await tx.update(usersTable).set({ role: "barber" })
        .where(and(eq(usersTable.id, salon.userId), eq(usersTable.role, "client")));
    }
    return salon;
  });
  if (!updated) {
    const [current] = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
    res.status(current ? 409 : 404).json({ error: current ? "Salon must be pending approval" : "Barber not found" });
    return;
  }
  const [owner] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
  notifyBarberEmail(owner?.email, "Votre salon est approuvé", {
    heading: "Votre salon est approuvé",
    intro: `Le salon « ${updated.salonName} » a été approuvé par notre équipe.`,
    paragraphs: [
      "Vous avez maintenant accès aux fonctionnalités barbier : services, horaires et réservations.",
      "Vous pouvez ajouter un document professionnel facultatif depuis votre profil. Il n'est pas nécessaire pour accéder à votre salon.",
    ],
  });
  void sendPush(
    updated.userId,
    "Salon approuvé",
    "Votre salon est approuvé. Vous pouvez gérer vos services, horaires et réservations.",
    { type: "barber_approved", barberId: updated.id },
  );
  res.json(updated);
}

router.patch("/barbers/:id/first-validate", requireAdminAuth, approveSalon);
router.patch("/barbers/:id/approve", requireAdminAuth, approveSalon);

// Reviewing an optional document never downgrades the salon or deletes its
// reference. Keep the submitted file and date available privately for history.
router.patch("/barbers/:id/document/reject", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid barber id" }); return; }
  const [current] = await db.select({ documentUrl: barbersTable.documentUrl })
    .from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!current) { res.status(404).json({ error: "Barber not found" }); return; }
  if (!current.documentUrl) {
    res.status(409).json({ error: "No submitted document to reject" });
    return;
  }
  const body = z.object({ reason: z.string().optional() }).safeParse(req.body ?? {});
  const reason = body.success ? body.data.reason?.trim() || "Document illisible ou non conforme." : "Document illisible ou non conforme.";
  const [updated] = await db.update(barbersTable).set({
    documentReviewNote: reason,
  }).where(and(eq(barbersTable.id, id), eq(barbersTable.documentUrl, current.documentUrl))).returning();
  if (!updated) { res.status(409).json({ error: "Document changed; refresh before retrying" }); return; }
  if (updated.userId) {
    const [owner] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    notifyBarberEmail(owner?.email, "Avis sur votre document facultatif", {
      heading: "Avis sur votre document facultatif",
      intro: `Le document du salon « ${updated.salonName} » n'a pas pu être validé.`,
      paragraphs: [
        `Motif : ${reason}`,
        "Vous pouvez le remplacer depuis votre profil si vous le souhaitez.",
      ],
      note: "Ce document est facultatif. Cet avis ne modifie ni le statut ni les accès de votre salon.",
    });
    void sendPush(
      updated.userId,
      "Avis sur votre document facultatif",
      "Vous pouvez remplacer votre document si vous le souhaitez. Le statut de votre salon ne change pas.",
      { type: "barber_document_rejected", barberId: updated.id },
    );
  }
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

// Admin: delete a barber account. Resolves the owning user and anonymizes it
// (not hard-delete) to preserve reservations/reviews referential integrity;
// the owned salon(s) are suspended + scrubbed in the same pass.
router.delete("/barbers/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [barber] = await db.select({ userId: barbersTable.userId }).from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!barber) { res.status(404).json({ error: "Barber not found" }); return; }
  await anonymizeUserAccount(barber.userId, req.log);
  res.status(204).send();
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
  const photos = await db.select().from(galleryPhotosTable).where(eq(galleryPhotosTable.barberId, id))
    .orderBy(asc(galleryPhotosTable.createdAt), asc(galleryPhotosTable.id));
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

// ── PANORAMAS (360° TOUR) ──────────────────────────────────────────────
router.get("/barbers/me/panoramas", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const rows = await db.select().from(panoramasTable)
    .where(eq(panoramasTable.barberId, b.id))
    .orderBy(panoramasTable.sortOrder, panoramasTable.createdAt);
  res.json(rows);
});

router.post("/barbers/me/panoramas", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const body = z.object({
    title: z.string().min(1).max(80),
    // Only accept object-storage paths produced by our upload flow (no external/inline URLs).
    imageUrl: z.string().min(1).refine((v) => v.startsWith("/objects/"), "Invalid image path"),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [maxRow] = await db.select({ max: sql<number>`coalesce(max(${panoramasTable.sortOrder}), 0)` })
    .from(panoramasTable)
    .where(eq(panoramasTable.barberId, b.id));
  const nextOrder = (maxRow?.max ?? 0) + 1;
  const [row] = await db.insert(panoramasTable).values({ barberId: b.id, sortOrder: nextOrder, ...body.data }).returning();
  res.status(201).json(row);
});

router.delete("/barbers/me/panoramas/:panoramaId", requireAuth, async (req: AuthedRequest, res) => {
  const b = await getMyBarberOr404(req, res);
  if (!b) return;
  const panoramaId = parseInt(String(req.params.panoramaId));
  // Scope delete by both panoramaId AND barberId to prevent IDOR.
  await db.delete(panoramasTable)
    .where(and(eq(panoramasTable.id, panoramaId), eq(panoramasTable.barberId, b.id)));
  res.status(204).send();
});

router.get("/barbers/:id/panoramas", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const rows = await db.select().from(panoramasTable)
    .where(eq(panoramasTable.barberId, id))
    .orderBy(panoramasTable.sortOrder, panoramasTable.createdAt);
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
