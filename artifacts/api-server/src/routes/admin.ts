import { Router } from "express";
import { db, usersTable, barbersTable, reservationsTable, subscriptionsTable, financingRequestsTable, reviewsTable } from "@workspace/db";
import { eq, count, avg, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/clerkAuth";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/admin/stats", async (_req, res) => {
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [totalBarbers] = await db.select({ count: count() }).from(barbersTable);
  const [approvedBarbers] = await db.select({ count: count() }).from(barbersTable).where(eq(barbersTable.status, "approved"));
  const [totalReservations] = await db.select({ count: count() }).from(reservationsTable);
  const [activeSubscriptions] = await db.select({ count: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));
  const [pendingFinancing] = await db.select({ count: count() }).from(financingRequestsTable).where(eq(financingRequestsTable.status, "pending"));
  const [pendingBarbers] = await db.select({ count: count() }).from(barbersTable).where(eq(barbersTable.status, "pending"));
  const [avgRating] = await db.select({ avg: avg(reviewsTable.rating) }).from(reviewsTable);
  res.json({
    totalUsers: totalUsers.count,
    totalBarbers: totalBarbers.count,
    totalSalons: approvedBarbers.count,
    totalReservations: totalReservations.count,
    activeSubscriptions: activeSubscriptions.count,
    pendingFinancing: pendingFinancing.count,
    pendingBarbers: pendingBarbers.count,
    averageRating: avgRating.avg ? parseFloat(avgRating.avg) : 0,
  });
});

router.get("/admin/stats/monthly", async (_req, res) => {
  const months: { month: string; reservations: number; newBarbers: number; newUsers: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const [res] = await db.select({ count: count() }).from(reservationsTable).where(sql`${reservationsTable.createdAt} >= ${start} AND ${reservationsTable.createdAt} < ${end}`);
    const [bar] = await db.select({ count: count() }).from(barbersTable).where(sql`${barbersTable.createdAt} >= ${start} AND ${barbersTable.createdAt} < ${end}`);
    const [usr] = await db.select({ count: count() }).from(usersTable).where(sql`${usersTable.createdAt} >= ${start} AND ${usersTable.createdAt} < ${end}`);
    months.push({ month: label, reservations: res.count, newBarbers: bar.count, newUsers: usr.count });
  }
  res.json(months);
});

router.get("/admin/stats/top-barbers", async (_req, res) => {
  const barbers = await db.select().from(barbersTable).where(eq(barbersTable.status, "approved")).limit(10);
  const enriched = await Promise.all(barbers.map(async b => {
    const [res] = await db.select({ count: count() }).from(reservationsTable).where(eq(reservationsTable.barberId, b.id));
    const [rat] = await db.select({ avg: avg(reviewsTable.rating) }).from(reviewsTable).where(eq(reviewsTable.barberId, b.id));
    return { barberId: b.id, salonName: b.salonName, city: b.city, reservations: res.count, rating: rat.avg ? parseFloat(rat.avg) : 0 };
  }));
  enriched.sort((a, b) => b.reservations - a.reservations);
  res.json(enriched);
});

router.get("/admin/recent-activity", async (_req, res) => {
  const reservations = await db.select().from(reservationsTable).orderBy(desc(reservationsTable.createdAt)).limit(5);
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5);
  const activity = [
    ...reservations.map(r => ({ id: r.id, type: "reservation", description: `New reservation #${r.id}`, createdAt: r.createdAt })),
    ...users.map(u => ({ id: u.id, type: "user", description: `New user: ${u.name}`, actorName: u.name, createdAt: u.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  res.json(activity);
});

export default router;
