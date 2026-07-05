import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, usersTable, barbersTable } from "@workspace/db";

type Logger = { warn?: (obj: unknown, msg?: string) => void };

/**
 * Anonymizes a user account instead of hard-deleting it. Reservations and
 * reviews reference the user via FK without ON DELETE CASCADE, so a real
 * DELETE would fail — we scrub PII while preserving referential integrity.
 *
 * Also anonymizes/suspends any barber salon(s) the user owns so they stop
 * appearing publicly, and deletes the underlying Clerk user.
 *
 * Used by both self-service deletion (DELETE /auth/me) and admin-initiated
 * deletion (DELETE /users/:id, DELETE /barbers/:id).
 */
export async function anonymizeUserAccount(userId: number, log?: Logger): Promise<void> {
  const [user] = await db
    .select({ id: usersTable.id, clerkUserId: usersTable.clerkUserId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) return;

  const ts = Date.now();
  const anonEmail = `deleted-${user.id}-${ts}@deleted.local`;

  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({
        name: "Compte supprimé",
        email: anonEmail,
        // Keep clerkUserId (do NOT null it out): requireAuth looks accounts up
        // by clerkUserId first, and Clerk IDs are never reused. Nulling it here
        // used to let a deleted account "resurrect" as a brand-new active
        // account if the best-effort Clerk deleteUser call below failed —
        // provisionUserFromClerk would then fail the clerkUserId lookup, fail
        // the (now-mismatched) email lookup, and insert a fresh row.
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

    // Anonymize + suspend any salon(s) this user owns so they leave public listings.
    await tx
      .update(barbersTable)
      .set({
        salonName: "Salon supprimé",
        bio: null,
        logoUrl: null,
        phone: null,
        whatsapp: null,
        address: null,
        neighborhood: null,
        latitude: null,
        longitude: null,
        status: "suspended",
        suspensionReason: "Compte supprimé",
      })
      .where(eq(barbersTable.userId, user.id));
  });

  if (user.clerkUserId) {
    try {
      await clerkClient.users.deleteUser(user.clerkUserId);
    } catch (e) {
      log?.warn?.({ err: e, userId: user.id }, "Failed to delete Clerk user; DB anonymized");
    }
  }
}
