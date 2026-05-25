import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "gbc-salt").digest("hex");
}

router.post("/auth/register", async (req, res) => {
  const body = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), phone: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const { name, email, password, phone } = body.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length) return res.status(409).json({ error: "Email already registered" });
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash: hashPassword(password), phone, role: "client", status: "active" }).returning();
  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.post("/auth/login", async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  const { email, password } = body.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || user.passwordHash !== hashPassword(password)) return res.status(401).json({ error: "Invalid credentials" });
  if (user.status === "suspended") return res.status(403).json({ error: "Account suspended" });
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, token: `gbc-token-${user.id}` });
});

router.get("/auth/me", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token?.startsWith("gbc-token-")) return res.status(401).json({ error: "Unauthorized" });
  const userId = parseInt(token.replace("gbc-token-", ""));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

export default router;
