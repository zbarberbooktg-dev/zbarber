import { Router } from "express";
import { db, financingRequestsTable, barbersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { requireAdminAuth, requireAuthOrAdmin, type AdminAuthedRequest } from "../lib/adminAuth";
import { notifyAdmin } from "../lib/email";

const router = Router();

router.get("/financing-requests", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const { page = "1", limit = "20", status } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let rows = await db.select().from(financingRequestsTable).orderBy(desc(financingRequestsTable.createdAt));
  if (!req.admin) {
    const user = req.localUser!;
    if (user.role === "barber") {
      const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
      rows = b ? rows.filter(r => r.barberId === b.id) : [];
    } else {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }
  if (status) rows = rows.filter(r => r.status === status);
  const enriched = await Promise.all(rows.slice(offset, offset + parseInt(limit)).map(async r => {
    const [barber] = await db.select({ salonName: barbersTable.salonName }).from(barbersTable).where(eq(barbersTable.id, r.barberId)).limit(1);
    return { ...r, barberName: barber?.salonName };
  }));
  res.json({ data: enriched, total: rows.length, page: parseInt(page), limit: parseInt(limit) });
});

router.get("/financing-requests/:id", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const [row] = await db.select().from(financingRequestsTable).where(eq(financingRequestsTable.id, parseInt(String(req.params.id)))).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (!req.admin) {
    const user = req.localUser!;
    if (user.role === "barber") {
      const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
      if (!b || row.barberId !== b.id) { res.status(403).json({ error: "Forbidden" }); return; }
    } else {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }
  const [barber] = await db.select({ salonName: barbersTable.salonName }).from(barbersTable).where(eq(barbersTable.id, row.barberId)).limit(1);
  res.json({ ...row, barberName: barber?.salonName });
});

router.post("/financing-requests", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  if (user.role !== "barber") { res.status(403).json({ error: "Only barbers can submit financing requests" }); return; }
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
  if (!b) { res.status(404).json({ error: "Barber profile not found" }); return; }
  if (b.status !== "approved") { res.status(403).json({ error: "Barber must be approved to submit a financing request" }); return; }

  const body = z.object({
    amount: z.number().min(50000).max(5000000),
    purpose: z.enum(["renovation", "tools", "products", "other"]),
    description: z.string().min(30),
    monthlyRevenue: z.number().min(0),
    yearsActive: z.number().int().min(0),
    repaymentMonths: z.number().int().min(3).max(24),
    documents: z.array(z.string().regex(/^\/objects\/[A-Za-z0-9_\-/.]+$/, "Invalid document path")).min(1),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input", details: body.error.issues }); return; }

  try {
    const created = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: financingRequestsTable.id, status: financingRequestsTable.status })
        .from(financingRequestsTable).for("update").where(eq(financingRequestsTable.barberId, b.id));
      if (existing.some(r => r.status === "pending" || r.status === "reviewing")) {
        throw new Error("ACTIVE_REQUEST_EXISTS");
      }
      const [row] = await tx.insert(financingRequestsTable).values({ ...body.data, barberId: b.id }).returning();
      return row;
    });
    notifyAdmin(
      "Nouvelle demande de financement",
      `Le salon "${b.salonName}" (#${b.id}) a soumis une demande de financement.\n\nMontant : ${body.data.amount} FC\nObjet : ${body.data.purpose}\nDurée de remboursement : ${body.data.repaymentMonths} mois`,
    );
    res.status(201).json(created);
  } catch (e) {
    if (e instanceof Error && e.message === "ACTIVE_REQUEST_EXISTS") {
      res.status(409).json({ error: "You already have a pending or under-review financing request" }); return;
    }
    throw e;
  }
});

router.patch("/financing-requests/:id", requireAdminAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = z.object({ status: z.enum(["pending", "reviewing", "approved", "rejected"]), adminNote: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const patch: Record<string, unknown> = { ...body.data };
  if (body.data.status === "approved" || body.data.status === "rejected") patch.reviewedAt = new Date();
  const [updated] = await db.update(financingRequestsTable).set(patch).where(eq(financingRequestsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
