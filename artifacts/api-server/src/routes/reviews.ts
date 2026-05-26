import { Router } from "express";
import { db, reviewsTable, usersTable, reservationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin, type AuthedRequest } from "../lib/clerkAuth";

const router = Router();

router.get("/reviews", async (req, res) => {
  const { page = "1", limit = "20", barberId } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let rows = await db.select().from(reviewsTable).orderBy(desc(reviewsTable.createdAt));
  if (barberId) rows = rows.filter(r => r.barberId === parseInt(barberId));
  const enriched = await Promise.all(rows.slice(offset, offset + parseInt(limit)).map(async r => {
    const [client] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.clientId)).limit(1);
    return { ...r, clientName: client?.name };
  }));
  res.json({ data: enriched, total: rows.length, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/reviews", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  if (user.role !== "client") { res.status(403).json({ error: "Only clients can review" }); return; }
  const body = z.object({ barberId: z.number(), rating: z.number().min(1).max(5), comment: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // Require a completed reservation with this barber
  const completed = await db.select().from(reservationsTable).where(and(eq(reservationsTable.clientId, user.id), eq(reservationsTable.barberId, body.data.barberId), eq(reservationsTable.status, "completed"))).limit(1);
  if (!completed.length) { res.status(403).json({ error: "Reservation completed required" }); return; }
  const [review] = await db.insert(reviewsTable).values({ ...body.data, clientId: user.id }).returning();
  res.status(201).json(review);
});

router.delete("/reviews/:id", requireAuth, requireAdmin, async (req, res) => {
  await db.delete(reviewsTable).where(eq(reviewsTable.id, parseInt(String(req.params.id))));
  res.status(204).send();
});

export default router;
