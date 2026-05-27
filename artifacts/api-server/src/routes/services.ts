import { Router } from "express";
import { db, servicesTable, serviceCategoriesTable, barbersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { requireAdminAuth } from "../lib/adminAuth";

const router = Router();

router.get("/services/categories", async (_req, res) => {
  const cats = await db.select().from(serviceCategoriesTable);
  res.json(cats);
});

router.post("/services/categories", requireAdminAuth, async (req, res) => {
  const body = z.object({ name: z.string(), icon: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [cat] = await db.insert(serviceCategoriesTable).values(body.data).returning();
  res.status(201).json(cat);
});

router.get("/barbers/:id/services", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const services = await db.select().from(servicesTable).where(eq(servicesTable.barberId, id));
  res.json(services);
});

router.post("/barbers/:id/services", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, id)).limit(1);
  if (!b || (b.userId !== req.localUser!.id && req.localUser!.role !== "admin")) { res.status(403).json({ error: "Forbidden" }); return; }
  if (b.status !== "approved" && req.localUser!.role !== "admin") { res.status(403).json({ error: "Barber not approved" }); return; }
  const body = z.object({ name: z.string(), description: z.string().optional(), price: z.number(), durationMinutes: z.number(), categoryId: z.number().optional(), photoUrl: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [service] = await db.insert(servicesTable).values({ barberId: id, ...body.data }).returning();
  res.status(201).json(service);
});

router.get("/services/:id", async (req, res) => {
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, parseInt(String(req.params.id)))).limit(1);
  if (!service) { res.status(404).json({ error: "Service not found" }); return; }
  res.json(service);
});

router.patch("/services/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [s] = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).limit(1);
  if (!s) { res.status(404).json({ error: "Service not found" }); return; }
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, s.barberId)).limit(1);
  if (!b || (b.userId !== req.localUser!.id && req.localUser!.role !== "admin")) { res.status(403).json({ error: "Forbidden" }); return; }
  const body = z.object({ name: z.string().optional(), description: z.string().optional(), price: z.number().optional(), durationMinutes: z.number().optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db.update(servicesTable).set(body.data).where(eq(servicesTable.id, id)).returning();
  res.json(updated);
});

router.delete("/services/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [s] = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).limit(1);
  if (!s) { res.status(204).send(); return; }
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, s.barberId)).limit(1);
  if (!b || (b.userId !== req.localUser!.id && req.localUser!.role !== "admin")) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(servicesTable).where(eq(servicesTable.id, id));
  res.status(204).send();
});

export default router;
