import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/users", async (req, res) => {
  const { page = "1", limit = "20", search = "", role, status } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, status: usersTable.status, phone: usersTable.phone, avatarUrl: usersTable.avatarUrl, createdAt: usersTable.createdAt }).from(usersTable);
  const conditions: ReturnType<typeof eq>[] = [];
  if (search) conditions.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`))!);
  if (role) conditions.push(eq(usersTable.role, role as "client" | "barber" | "admin"));
  if (status) conditions.push(eq(usersTable.status, status as "active" | "suspended" | "pending"));
  const allRows = await (conditions.length ? query.where(sql.raw(`${conditions.map(c => `(${c})`).join(" AND ")}`)) : query);
  const total = allRows.length;
  const data = allRows.slice(offset, offset + parseInt(limit));
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, status: usersTable.status, phone: usersTable.phone, avatarUrl: usersTable.avatarUrl, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

router.patch("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ name: z.string().optional(), phone: z.string().optional(), avatarUrl: z.string().optional(), role: z.enum(["client", "barber", "admin"]).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const [updated] = await db.update(usersTable).set(body.data).where(eq(usersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

router.post("/users/:id/suspend", async (req, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(usersTable).set({ status: "suspended" }).where(eq(usersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

router.post("/users/:id/activate", async (req, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(usersTable).set({ status: "active" }).where(eq(usersTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

export default router;
