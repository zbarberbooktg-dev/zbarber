import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, usersTable, accountDeletionRequestsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/clerkAuth";

const router = Router();

// ── Authenticated: delete my account ───
// Anonymizes the user row (preserving reservations/reviews referential
// integrity) and deletes the underlying Clerk user. Barber profile (if any)
// is removed via FK cascade.
router.delete("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.localUser!;
  const ts = Date.now();
  const anonEmail = `deleted-${user.id}-${ts}@deleted.local`;
  try {
    await db.update(usersTable)
      .set({
        name: "Compte supprimé",
        email: anonEmail,
        clerkUserId: null,
        phone: null,
        avatarUrl: null,
        city: null,
        country: null,
        latitude: null,
        longitude: null,
        locationUpdatedAt: null,
        status: "suspended",
      })
      .where(eq(usersTable.id, user.id));

    if (user.clerkUserId) {
      try {
        await clerkClient.users.deleteUser(user.clerkUserId);
      } catch (e) {
        req.log?.warn?.({ err: e, userId: user.id }, "Failed to delete Clerk user; DB anonymized");
      }
    }

    res.json({ ok: true });
  } catch (e) {
    req.log?.error?.({ err: e, userId: user.id }, "Account deletion failed");
    res.status(500).json({ error: "Account deletion failed" });
  }
});

// ── Public: deletion request (used by the vitrine, no auth) ───
router.post("/account-deletion-requests", async (req, res) => {
  const body = z.object({
    email: z.string().email(),
    fullName: z.string().min(2).optional(),
    reason: z.string().max(2000).optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  // Best-effort link to an existing user (does not authenticate; informational only)
  const [linked] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, body.data.email.toLowerCase()))
    .limit(1);

  const [created] = await db.insert(accountDeletionRequestsTable).values({
    email: body.data.email.toLowerCase(),
    fullName: body.data.fullName ?? null,
    reason: body.data.reason ?? null,
    userId: linked?.id ?? null,
  }).returning({ id: accountDeletionRequestsTable.id });

  res.status(201).json({ id: created.id, ok: true });
});

export default router;
