import { Router } from "express";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/notifications", async (_req, res) => {
  const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(100);
  res.json(rows);
});

router.post("/notifications", async (req, res) => {
  const body = z.object({ userId: z.number().optional(), type: z.enum(["new_reservation", "confirmation", "reminder", "admin_announcement", "subscription_expiry"]), title: z.string(), message: z.string().optional(), relatedId: z.number().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });
  if (!body.data.userId) {
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
    const inserted = await db.insert(notificationsTable).values(allUsers.map(u => ({ ...body.data, userId: u.id }))).returning();
    return res.status(201).json(inserted);
  }
  const [notif] = await db.insert(notificationsTable).values(body.data).returning();
  res.status(201).json(notif);
});

router.patch("/notifications/:id/read", async (req, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

export default router;
