import { Router } from "express";
import { db, notificationsTable, usersTable, barbersTable, deviceTokensTable } from "@workspace/db";
import { eq, desc, and, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { requireAdminAuth, requireAuthOrAdmin, type AdminAuthedRequest } from "../lib/adminAuth";

const router = Router();

// Register (or refresh) the Expo push token for the calling user's device. The
// token is globally unique: if this device was previously bound to a different
// account, the row is re-pointed to the current user so a token never delivers
// to the wrong account.
router.post("/notifications/device-token", requireAuth, async (req: AuthedRequest, res) => {
  const body = z.object({ token: z.string().min(1), platform: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const user = req.localUser!;
  const [row] = await db
    .insert(deviceTokensTable)
    .values({ userId: user.id, token: body.data.token, platform: body.data.platform ?? null })
    .onConflictDoUpdate({
      target: deviceTokensTable.token,
      set: { userId: user.id, platform: body.data.platform ?? null, updatedAt: new Date() },
    })
    .returning();
  res.status(201).json(row);
});

// Unregister a device token (e.g. on sign-out). Scoped to the calling user so a
// user can only remove their own device bindings.
router.delete("/notifications/device-token", requireAuth, async (req: AuthedRequest, res) => {
  const body = z.object({ token: z.string().min(1) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  await db
    .delete(deviceTokensTable)
    .where(and(eq(deviceTokensTable.token, body.data.token), eq(deviceTokensTable.userId, req.localUser!.id)));
  res.status(204).end();
});

router.get("/notifications", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  if (req.admin) {
    const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(100);
    res.json(rows); return;
  }
  const user = req.localUser!;
  // Per-salon scoping: when a (validated, owned) salonId is given, return that
  // salon's notifications plus account-wide ones (barberId IS NULL). Without a
  // salonId, return the full per-user feed.
  const rawSalon = (req.query as Record<string, string>).salonId;
  let where = eq(notificationsTable.userId, user.id);
  if (rawSalon !== undefined && rawSalon !== "") {
    const sid = parseInt(rawSalon);
    if (!Number.isFinite(sid)) { res.status(400).json({ error: "Invalid salonId" }); return; }
    const owned = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.userId, user.id));
    if (!owned.some(o => o.id === sid)) { res.status(403).json({ error: "Salon not owned" }); return; }
    where = and(
      eq(notificationsTable.userId, user.id),
      or(eq(notificationsTable.barberId, sid), isNull(notificationsTable.barberId)),
    )!;
  }
  const rows = await db.select().from(notificationsTable).where(where).orderBy(desc(notificationsTable.createdAt)).limit(100);
  res.json(rows);
});

router.post("/notifications", requireAdminAuth, async (req, res) => {
  const body = z.object({ userId: z.number().optional(), barberId: z.number().optional(), type: z.enum(["new_reservation", "confirmation", "reminder", "admin_announcement", "subscription_expiry"]), title: z.string(), message: z.string().optional(), relatedId: z.number().optional() }).safeParse(req.body);
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
