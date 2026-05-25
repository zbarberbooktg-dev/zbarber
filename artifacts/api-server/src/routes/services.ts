import { Router } from "express";
import { db, servicesTable, serviceCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/services/categories", async (_req, res) => {
  const cats = await db.select().from(serviceCategoriesTable);
  res.json(cats);
});

router.post("/services/categories", async (req, res) => {
  const body = z.object({ name: z.string(), icon: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [cat] = await db.insert(serviceCategoriesTable).values(body.data).returning();
  res.status(201).json(cat);
});

router.get("/barbers/:id/services", async (req, res) => {
  const id = parseInt(req.params.id);
  const services = await db.select().from(servicesTable).where(eq(servicesTable.barberId, id));
  res.json(services);
});

router.post("/barbers/:id/services", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ name: z.string(), description: z.string().optional(), price: z.number(), durationMinutes: z.number(), categoryId: z.number().optional(), photoUrl: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [service] = await db.insert(servicesTable).values({ barberId: id, ...body.data }).returning();
  res.status(201).json(service);
});

router.get("/services/:id", async (req, res) => {
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, parseInt(req.params.id))).limit(1);
  if (!service) return res.status(404).json({ error: "Service not found" });
  res.json(service);
});

router.patch("/services/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ name: z.string().optional(), description: z.string().optional(), price: z.number().optional(), durationMinutes: z.number().optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [updated] = await db.update(servicesTable).set(body.data).where(eq(servicesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Service not found" });
  res.json(updated);
});

router.delete("/services/:id", async (req, res) => {
  await db.delete(servicesTable).where(eq(servicesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

export default router;
