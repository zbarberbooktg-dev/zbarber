import { Router } from "express";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { requireAdminAuth, requireAuthOrAdmin, type AdminAuthedRequest } from "../lib/adminAuth";

const router = Router();

router.get("/notifications", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  if (req.admin) {
    const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(100);
    res.json(rows); return;
  }
  const user = req.localUser!;
  const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, user.id)).orderBy(desc(notificationsTable.createdAt)).limit(100);
  res.json(rows);
});

router.post("/notifications", requireAdminAuth, async (req, res) => {
  const body = z.object({ userId: z.number().optional(), type: z.enum(["new_reservation", "confirmation", "reminder", "admin_announcement", "subscription_expiry"]), title: z.string(), message: z.string().optional(), relatedId: z.number().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  if (!body.data.userId) {
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
    const inserted = await db.insert(notificationsTable).values(allUsers.map(u => ({ ...body.data, userId: u.id }))).returning();
    res.status(201).json(inserted); return;
  }
  const [notif] = await db.insert(notificationsTable).values(body.data).returning();
  res.status(201).json(notif);
});

router.patch("/notifications/:id/read", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const where = req.admin
    ? eq(notificationsTable.id, id)
    : and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.localUser!.id));
  const [updated] = await db.update(notificationsTable).set({ isRead: true }).where(where).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
