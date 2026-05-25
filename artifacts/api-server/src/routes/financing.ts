import { Router } from "express";
import { db, financingRequestsTable, barbersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/financing-requests", async (req, res) => {
  const { page = "1", limit = "20", status } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let rows = await db.select().from(financingRequestsTable).orderBy(desc(financingRequestsTable.createdAt));
  if (status) rows = rows.filter(r => r.status === status);
  const enriched = await Promise.all(rows.slice(offset, offset + parseInt(limit)).map(async r => {
    const [barber] = await db.select({ salonName: barbersTable.salonName }).from(barbersTable).where(eq(barbersTable.id, r.barberId)).limit(1);
    return { ...r, barberName: barber?.salonName };
  }));
  res.json({ data: enriched, total: rows.length, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/financing-requests", async (req, res) => {
  const body = z.object({ barberId: z.number(), amount: z.number(), purpose: z.enum(["renovation", "tools", "products", "other"]), description: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [req2] = await db.insert(financingRequestsTable).values(body.data).returning();
  res.status(201).json(req2);
});

router.get("/financing-requests/:id", async (req, res) => {
  const [row] = await db.select().from(financingRequestsTable).where(eq(financingRequestsTable.id, parseInt(req.params.id))).limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  const [barber] = await db.select({ salonName: barbersTable.salonName }).from(barbersTable).where(eq(barbersTable.id, row.barberId)).limit(1);
  res.json({ ...row, barberName: barber?.salonName });
});

router.patch("/financing-requests/:id/status", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ status: z.enum(["pending", "reviewing", "approved", "rejected"]), adminNote: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [updated] = await db.update(financingRequestsTable).set(body.data).where(eq(financingRequestsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

export default router;
