import { Router } from "express";
import { db, usersTable, barbersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";
import { resolveAndPersistLocation, UnknownCountryError } from "./locations";

const router = Router();

router.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  const { passwordHash: _, ...safeUser } = user;
  let barber = null;
  if (user.role === "barber") {
    const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, user.id)).limit(1);
    barber = b ?? null;
  }
  res.json({ user: safeUser, barber });
});

router.post("/auth/sync", requireAuth, async (req: AuthedRequest, res) => {
  const body = z.object({
    role: z.enum(["client", "barber"]).optional(),
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    avatarUrl: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const user = req.localUser!;
  const update: Partial<typeof usersTable.$inferInsert> = {};
  if (body.data.name && body.data.name !== user.name) update.name = body.data.name;
  if (body.data.phone && body.data.phone !== user.phone) update.phone = body.data.phone;
  if (body.data.city !== undefined || body.data.country !== undefined) {
    try {
      const resolved = await resolveAndPersistLocation({
        countryName: body.data.country ?? user.country,
        cityName: body.data.city ?? user.city,
      });
      if (body.data.country !== undefined && resolved.country !== user.country) update.country = resolved.country;
      if (body.data.city !== undefined && resolved.city !== user.city) update.city = resolved.city;
    } catch (e) {
      if (e instanceof UnknownCountryError) { res.status(400).json({ error: "Unknown country" }); return; }
      throw e;
    }
  }
  if (body.data.avatarUrl !== undefined && body.data.avatarUrl !== user.avatarUrl) update.avatarUrl = body.data.avatarUrl || null;
  if (body.data.role && user.role !== "admin" && user.role !== body.data.role) update.role = body.data.role;

  let final = user;
  if (Object.keys(update).length) {
    const [updated] = await db.update(usersTable).set(update).where(eq(usersTable.id, user.id)).returning();
    final = updated;
  }

  let barber = null;
  if (final.role === "barber") {
    const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, final.id)).limit(1);
    barber = b ?? null;
  }

  const { passwordHash: _, ...safeUser } = final;
  res.json({ user: safeUser, barber });
});

export default router;
