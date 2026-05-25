import { Router } from "express";
import { db, reviewsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

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

router.post("/reviews", async (req, res) => {
  const body = z.object({ clientId: z.number(), barberId: z.number(), rating: z.number().min(1).max(5), comment: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [review] = await db.insert(reviewsTable).values(body.data).returning();
  res.status(201).json(review);
});

router.delete("/reviews/:id", async (req, res) => {
  await db.delete(reviewsTable).where(eq(reviewsTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

export default router;
