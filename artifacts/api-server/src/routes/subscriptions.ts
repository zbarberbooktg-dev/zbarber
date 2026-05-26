import { Router } from "express";
import { db, subscriptionPlansTable, subscriptionsTable, barbersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../lib/clerkAuth";

const router = Router();

router.get("/subscription-plans", async (_req, res) => {
  const plans = await db.select().from(subscriptionPlansTable);
  res.json(plans);
});

router.post("/subscription-plans", requireAuth, requireAdmin, async (req, res) => {
  const body = z.object({ name: z.string(), description: z.string().optional(), price: z.number(), billingCycle: z.enum(["monthly", "yearly"]).optional(), features: z.array(z.string()).optional(), maxPhotos: z.number().optional(), hasAnalytics: z.boolean().optional(), hasPriority: z.boolean().optional(), hasFinancing: z.boolean().optional(), hasConferences: z.boolean().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [plan] = await db.insert(subscriptionPlansTable).values(body.data).returning();
  res.status(201).json(plan);
});

router.patch("/subscription-plans/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ name: z.string().optional(), description: z.string().optional(), price: z.number().optional(), isActive: z.boolean().optional(), features: z.array(z.string()).optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db.update(subscriptionPlansTable).set(body.data).where(eq(subscriptionPlansTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/subscription-plans/:id", requireAuth, requireAdmin, async (req, res) => {
  await db.delete(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, parseInt(String(req.params.id))));
  res.status(204).send();
});

router.get("/subscriptions", requireAuth, requireAdmin, async (req, res) => {
  const { page = "1", limit = "20", status } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let subs = await db.select().from(subscriptionsTable).orderBy(desc(subscriptionsTable.createdAt));
  if (status) subs = subs.filter(s => s.status === status);
  const enriched = await Promise.all(subs.slice(offset, offset + parseInt(limit)).map(async s => {
    const [barber] = await db.select({ salonName: barbersTable.salonName }).from(barbersTable).where(eq(barbersTable.id, s.barberId)).limit(1);
    const [plan] = await db.select({ name: subscriptionPlansTable.name }).from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, s.planId)).limit(1);
    return { ...s, barberName: barber?.salonName, planName: plan?.name };
  }));
  res.json({ data: enriched, total: subs.length, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/subscriptions", requireAuth, requireAdmin, async (req, res) => {
  const body = z.object({ barberId: z.number(), planId: z.number(), endDate: z.string(), paymentMethod: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [sub] = await db.insert(subscriptionsTable).values({ ...body.data, endDate: new Date(body.data.endDate) }).returning();
  res.status(201).json(sub);
});

export default router;
