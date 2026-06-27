import { Router } from "express";
import { db, reservationsTable, usersTable, barbersTable, servicesTable } from "@workspace/db";
import { eq, desc, or, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { requireAuthOrAdmin, type AdminAuthedRequest } from "../lib/adminAuth";
import { sendPush } from "../lib/push";
import { sendThankYouEmail } from "../lib/reminderScheduler";

const router = Router();

// Resolve the salon name + owning account for a reservation, used to address
// lifecycle push notifications. Returns nulls when the salon is missing.
async function resolveSalon(barberId: number): Promise<{ salonName: string; ownerUserId: number } | null> {
  const [b] = await db.select({ salonName: barbersTable.salonName, userId: barbersTable.userId }).from(barbersTable).where(eq(barbersTable.id, barberId)).limit(1);
  if (!b) return null;
  return { salonName: b.salonName, ownerUserId: b.userId };
}

async function enrichReservation(r: typeof reservationsTable.$inferSelect) {
  const [client] = await db.select({ name: usersTable.name, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, r.clientId)).limit(1);
  const [barber] = await db.select({ salonName: barbersTable.salonName, userId: barbersTable.userId }).from(barbersTable).where(eq(barbersTable.id, r.barberId)).limit(1);
  const [service] = await db.select({ name: servicesTable.name, price: servicesTable.price }).from(servicesTable).where(eq(servicesTable.id, r.serviceId)).limit(1);
  return { ...r, clientName: client?.name, clientPhone: client?.phone ?? null, barberName: barber?.salonName, serviceName: service?.name, servicePrice: service?.price };
}

router.get("/reservations", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const { page = "1", limit = "20", status, barberId, clientId, dateFrom, dateTo, search } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let rows = await db.select().from(reservationsTable).orderBy(desc(reservationsTable.createdAt));
  if (!req.admin) {
    const user = req.localUser!;
    if (user.role === "client") {
      rows = rows.filter(r => r.clientId === user.id);
    } else if (user.role === "barber") {
      // Salons are independent. Show reservations for the selected salon when a
      // (validated, owned) salonId is given; otherwise show every owned salon's
      // reservations — never collapse to the first salon only.
      const owned = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.userId, user.id));
      const ownedIds = owned.map(o => o.id);
      const rawSalon = (req.query as Record<string, string>).salonId;
      if (rawSalon !== undefined && rawSalon !== "") {
        const sid = parseInt(rawSalon);
        if (!Number.isFinite(sid) || !ownedIds.includes(sid)) { res.status(403).json({ error: "Salon not owned" }); return; }
        rows = rows.filter(r => r.barberId === sid);
      } else {
        rows = ownedIds.length ? rows.filter(r => ownedIds.includes(r.barberId)) : [];
      }
    }
  }
  // admin: see all
  if (status) rows = rows.filter(r => r.status === status);
  if (barberId) rows = rows.filter(r => r.barberId === parseInt(barberId));
  if (clientId) rows = rows.filter(r => r.clientId === parseInt(clientId));
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00.000Z`);
    rows = rows.filter(r => new Date(r.scheduledAt) >= from);
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59.999Z`);
    rows = rows.filter(r => new Date(r.scheduledAt) <= to);
  }
  let enriched = await Promise.all(rows.map(enrichReservation));
  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter(r =>
      (r.clientName?.toLowerCase().includes(q) ?? false) ||
      (r.barberName?.toLowerCase().includes(q) ?? false) ||
      (r.serviceName?.toLowerCase().includes(q) ?? false)
    );
  }
  const total = enriched.length;
  const data = enriched.slice(offset, offset + parseInt(limit));
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post("/reservations", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  // Any non-admin account can book like a client (a barber browses and books in
  // other salons exactly like a client). Admins manage, they do not book.
  if (user.role === "admin") { res.status(403).json({ error: "Admins cannot book" }); return; }
  const body = z.object({ barberId: z.number(), serviceId: z.number(), scheduledAt: z.string(), notes: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // Verify barber is approved
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.id, body.data.barberId)).limit(1);
  if (!b || b.status !== "approved") { res.status(400).json({ error: "Barber not available" }); return; }
  const scheduledAt = new Date(body.data.scheduledAt);
  // Prevent double-booking: an active (pending or confirmed) reservation already
  // occupying this exact slot for this barber blocks the booking. The
  // availability endpoint marks such slots unavailable, but a client racing two
  // requests (or a stale slot list) could still POST a taken slot, so the
  // server is the authority. Cancelled/completed reservations free the slot.
  const [clash] = await db.select({ id: reservationsTable.id }).from(reservationsTable)
    .where(and(
      eq(reservationsTable.barberId, body.data.barberId),
      eq(reservationsTable.scheduledAt, scheduledAt),
      inArray(reservationsTable.status, ["pending", "confirmed"]),
    )).limit(1);
  if (clash) { res.status(409).json({ error: "Slot already booked" }); return; }
  const [res2] = await db.insert(reservationsTable).values({ ...body.data, clientId: user.id, scheduledAt }).returning();
  // Booking again resets the re-engagement clock so the client only gets a
  // "come back" push after their NEXT quiet stretch.
  await db.update(usersTable).set({ lastReengagementAt: null }).where(eq(usersTable.id, user.id));
  const enriched = await enrichReservation(res2);
  // Notify both parties of the new booking (fire-and-forget).
  const salonName = enriched.barberName ?? "votre salon";
  const serviceName = enriched.serviceName ?? "une prestation";
  void sendPush(user.id, "Réservation envoyée", `Votre demande chez ${salonName} a bien été enregistrée.`, { type: "reservation_created", reservationId: res2.id });
  if (b.userId) void sendPush(b.userId, "Nouvelle réservation", `${enriched.clientName ?? "Un client"} a réservé « ${serviceName} ».`, { type: "reservation_created", reservationId: res2.id });
  res.status(201).json(enriched);
});

router.get("/reservations/:id", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const [r] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, parseInt(String(req.params.id)))).limit(1);
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (!req.admin) {
    const user = req.localUser!;
    if (user.role === "client" && r.clientId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    if (user.role === "barber") {
      const owned = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.userId, user.id));
      if (!owned.some(o => o.id === r.barberId)) { res.status(403).json({ error: "Forbidden" }); return; }
    }
  }
  res.json(await enrichReservation(r));
});

router.patch("/reservations/:id", requireAuthOrAdmin, async (req: AdminAuthedRequest & AuthedRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [existing] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  // Admin path: any status.
  if (req.admin) {
    const body = z.object({ status: z.enum(["pending", "confirmed", "cancelled", "completed"]) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const [updated] = await db.update(reservationsTable).set({ status: body.data.status }).where(eq(reservationsTable.id, id)).returning();
    await notifyStatusChange(existing, updated, "admin");
    res.json(await enrichReservation(updated));
    return;
  }

  const user = req.localUser!;
  // Client can cancel their own. Barber can confirm/complete/cancel their own.
  if (user.role === "client" && existing.clientId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (user.role === "barber") {
    const owned = await db.select({ id: barbersTable.id }).from(barbersTable).where(eq(barbersTable.userId, user.id));
    if (!owned.some(o => o.id === existing.barberId)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  // Clients may only cancel their own reservation; barbers can set any status on their salon.
  const allowedStatuses = user.role === "client"
    ? (["cancelled"] as const)
    : (["pending", "confirmed", "cancelled", "completed"] as const);
  const body = z.object({ status: z.enum(allowedStatuses) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  // Enforce 24h cancellation window for clients.
  if (user.role === "client" && body.data.status === "cancelled") {
    const scheduled = new Date(existing.scheduledAt).getTime();
    if (scheduled - Date.now() < 24 * 60 * 60 * 1000) {
      res.status(409).json({ error: "Cancellation window closed — less than 24h before appointment." });
      return;
    }
  }
  const [updated] = await db.update(reservationsTable).set({ status: body.data.status }).where(eq(reservationsTable.id, id)).returning();
  await notifyStatusChange(existing, updated, user.role === "barber" ? "barber" : "client");
  res.json(await enrichReservation(updated));
});

// Send the appropriate push (and thank-you email) when a reservation's status
// changes. No-op when the status is unchanged. Pushes/emails are fire-and-forget
// so they never block or break the request.
async function notifyStatusChange(
  before: typeof reservationsTable.$inferSelect,
  after: typeof reservationsTable.$inferSelect,
  actor: "client" | "barber" | "admin",
): Promise<void> {
  if (before.status === after.status) return;
  const salon = await resolveSalon(after.barberId);
  const salonName = salon?.salonName ?? "le salon";

  if (after.status === "confirmed") {
    // Barber/admin confirmed → tell the client.
    void sendPush(after.clientId, "Réservation confirmée", `${salonName} a confirmé votre rendez-vous.`, { type: "reservation_confirmed", reservationId: after.id });
  } else if (after.status === "cancelled") {
    // A client cancellation notifies the barber; a barber/admin cancellation
    // notifies the client.
    if (actor === "client") {
      if (salon?.ownerUserId) void sendPush(salon.ownerUserId, "Réservation annulée", "Un client a annulé son rendez-vous.", { type: "reservation_cancelled", reservationId: after.id });
    } else {
      void sendPush(after.clientId, "Réservation annulée", `${salonName} a annulé votre rendez-vous.`, { type: "reservation_cancelled", reservationId: after.id });
    }
  } else if (after.status === "completed") {
    // Thank-you / review-invite email (claim-then-send guards against dupes).
    void sendThankYouEmail(after.id);
  } else {
    // Any other status change (e.g. back to pending = a modification) tells the
    // barber so they can re-review.
    if (salon?.ownerUserId && actor !== "barber") void sendPush(salon.ownerUserId, "Réservation modifiée", "Un rendez-vous a été modifié.", { type: "reservation_modified", reservationId: after.id });
  }
}

// silence unused import
void or;

export default router;
