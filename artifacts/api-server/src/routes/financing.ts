import { Router } from "express";
import { db, financingRequestsTable, barbersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin, type AuthedRequest } from "../lib/clerkAuth";

const router = Router();

router.get("/financing-requests", requireAuth, async (req: AuthedRequest, res) => {
  const { page = "1", limit = "20", status } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const user = req.localUser!;
  let rows = await db.select().from(financingRequestsTable).orderBy(desc(financingRequestsTable.createdAt));
  if (user.role === "barber") {
    const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
    rows = b ? rows.filter(r => r.barberId === b.id) : [];
  } else if (user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (status) rows = rows.filter(r => r.status === status);
  const enriched = await Promise.all(rows.slice(offset, offset + parseInt(limit)).map(async r => {
    const [barber] = await db.select({ salonName: barbersTable.salonName }).from(barbersTable).where(eq(barbersTable.id, r.barberId)).limit(1);
    return { ...r, barberName: barber?.salonName };
  }));
  res.json({ data: enriched, total: rows.length, page: parseInt(page), limit: parseInt(limit) });
});

router.get("/financing-requests/:id", requireAuth, async (req: AuthedRequest, res) => {
  const [row] = await db.select().from(financingRequestsTable).where(eq(financingRequestsTable.id, parseInt(String(req.params.id)))).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const user = req.localUser!;
  if (user.role === "barber") {
    const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
    if (!b || row.barberId !== b.id) { res.status(403).json({ error: "Forbidden" }); return; }
  } else if (user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const [barber] = await db.select({ salonName: barbersTable.salonName }).from(barbersTable).where(eq(barbersTable.id, row.barberId)).limit(1);
  res.json({ ...row, barberName: barber?.salonName });
});

router.patch("/financing-requests/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ status: z.enum(["pending", "reviewing", "approved", "rejected"]), adminNote: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [updated] = await db.update(financingRequestsTable).set(body.data).where(eq(financingRequestsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
