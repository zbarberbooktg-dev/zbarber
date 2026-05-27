import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { requireAdminAuth } from "../lib/adminAuth";

const router = Router();

// Self-service: update own profile (name, phone, avatar, city, country)
router.patch("/users/me", requireAuth, async (req: AuthedRequest, res) => {
  const body = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(3).nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const data = body.data;
  if (Object.keys(data).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [updated] = await db.update(usersTable).set(data).where(eq(usersTable.id, req.localUser!.id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

// Self-service: update own geographic position
router.post("/users/me/location", requireAuth, async (req: AuthedRequest, res) => {
  const body = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid coordinates" }); return; }
  const [updated] = await db
    .update(usersTable)
    .set({ latitude: body.data.latitude, longitude: body.data.longitude, locationUpdatedAt: new Date() })
    .where(eq(usersTable.id, req.localUser!.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

router.get("/users", requireAdminAuth, async (req, res) => {
  const { page = "1", limit = "20", search = "", role, status } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const query = db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, status: usersTable.status, phone: usersTable.phone, avatarUrl: usersTable.avatarUrl, city: usersTable.city, country: usersTable.country, latitude: usersTable.latitude, longitude: usersTable.longitude, locationUpdatedAt: usersTable.locationUpdatedAt, createdAt: usersTable.createdAt }).from(usersTable);
  const conditions: ReturnType<typeof eq>[] = [];
  if (search) conditions.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`))!);
  if (role) conditions.push(eq(usersTable.role, role as "client" | "barber" | "admin"));
  if (status) conditions.push(eq(usersTable.status, status as "active" | "suspended" | "pending"));
  const allRows = await (conditions.length ? query.where(sql.raw(`${conditions.map(c => `(${c})`).join(" AND ")}`)) : query);
  const total = allRows.length;
  const data = allRows.slice(offset, offset + parseInt(limit));
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get("/users/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, status: usersTable.status, phone: usersTable.phone, avatarUrl: usersTable.avatarUrl, city: usersTable.city, country: usersTable.country, latitude: usersTable.latitude, longitude: usersTable.longitude, locationUpdatedAt: usersTable.locationUpdatedAt, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.patch("/users/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ name: z.string().optional(), phone: z.string().nullable().optional(), avatarUrl: z.string().nullable().optional(), city: z.string().nullable().optional(), country: z.string().nullable().optional(), role: z.enum(["client", "barber", "admin"]).optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db.update(usersTable).set(body.data).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

router.delete("/users/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

router.patch("/users/:id/suspend", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [updated] = await db.update(usersTable).set({ status: "suspended" }).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

router.patch("/users/:id/activate", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const [updated] = await db.update(usersTable).set({ status: "active" }).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

export default router;
