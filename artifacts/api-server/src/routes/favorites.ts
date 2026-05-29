import { Router, type IRouter } from "express";
import { db, favoritesTable, barbersTable, usersTable, reviewsTable } from "@workspace/db";
import { and, avg, count, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";

const router: IRouter = Router();

async function barberWithDetails(id: number) {
  const [barber] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!barber) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, barber.userId)).limit(1);
  const ratingRes = await db.select({ avg: avg(reviewsTable.rating), count: count() }).from(reviewsTable).where(eq(reviewsTable.barberId, id));
  return { ...barber, ownerName: user?.name, rating: ratingRes[0]?.avg ? parseFloat(ratingRes[0].avg) : 0, reviewCount: ratingRes[0]?.count ?? 0 };
}

// ── Client: list my favorite salons ───
router.get("/favorites", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await db.select({ barberId: favoritesTable.barberId })
    .from(favoritesTable)
    .where(eq(favoritesTable.userId, req.localUser!.id))
    .orderBy(favoritesTable.createdAt);
  const enriched = await Promise.all(rows.map((r) => barberWithDetails(r.barberId)));
  res.json(enriched.filter(Boolean));
});

// ── Client: add a salon to favorites (idempotent) ───
router.post("/favorites", requireAuth, async (req: AuthedRequest, res) => {
  const body = z.object({ barberId: z.number().int() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [barber] = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.id, body.data.barberId)).limit(1);
  if (!barber) { res.status(404).json({ error: "Salon not found" }); return; }
  const [existing] = await db.select().from(favoritesTable)
    .where(and(eq(favoritesTable.userId, req.localUser!.id), eq(favoritesTable.barberId, body.data.barberId)))
    .limit(1);
  if (existing) { res.status(201).json(existing); return; }
  const [created] = await db.insert(favoritesTable)
    .values({ userId: req.localUser!.id, barberId: body.data.barberId })
    .returning();
  res.status(201).json(created);
});

// ── Client: remove a salon from favorites ───
router.delete("/favorites/:barberId", requireAuth, async (req: AuthedRequest, res) => {
  const barberId = parseInt(String(req.params.barberId));
  if (!Number.isFinite(barberId)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(favoritesTable)
    .where(and(eq(favoritesTable.userId, req.localUser!.id), eq(favoritesTable.barberId, barberId)));
  res.status(204).send();
});

export default router;
