import { Router } from "express";
import { db, conferencesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAdminAuth } from "../lib/adminAuth";

const router = Router();

router.get("/conferences", async (req, res) => {
  const { page = "1", limit = "20", published } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let rows = await db.select().from(conferencesTable).orderBy(desc(conferencesTable.scheduledAt));
  if (published !== undefined) rows = rows.filter(c => c.isPublished === (published === "true"));
  res.json({ data: rows.slice(offset, offset + parseInt(limit)), total: rows.length, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/conferences", requireAdminAuth, async (req, res) => {
  const body = z.object({ title: z.string(), topic: z.string(), description: z.string().optional(), scheduledAt: z.string(), participationChannel: z.string().optional(), joinLink: z.string().optional(), instructions: z.string().optional(), isPublished: z.boolean().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [conf] = await db.insert(conferencesTable).values({ ...body.data, scheduledAt: new Date(body.data.scheduledAt) }).returning();
  res.status(201).json(conf);
});

router.get("/conferences/:id", async (req, res) => {
  const [conf] = await db.select().from(conferencesTable).where(eq(conferencesTable.id, parseInt(String(req.params.id)))).limit(1);
  if (!conf) { res.status(404).json({ error: "Not found" }); return; }
  res.json(conf);
});

router.patch("/conferences/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ title: z.string().optional(), topic: z.string().optional(), description: z.string().optional(), scheduledAt: z.string().optional(), isPublished: z.boolean().optional(), joinLink: z.string().optional(), instructions: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updateData: Record<string, unknown> = { ...body.data };
  if (body.data.scheduledAt) updateData.scheduledAt = new Date(body.data.scheduledAt);
  const [updated] = await db.update(conferencesTable).set(updateData).where(eq(conferencesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/conferences/:id", requireAdminAuth, async (req, res) => {
  await db.delete(conferencesTable).where(eq(conferencesTable.id, parseInt(String(req.params.id))));
  res.status(204).send();
});

export default router;
