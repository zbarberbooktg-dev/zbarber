import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable, barbersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthedRequest extends Request {
  clerkUserId?: string;
  localUser?: typeof usersTable.$inferSelect;
}

export async function provisionUserFromClerk(clerkUserId: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);
  if (existing.length) return existing[0];

  const cu = await clerkClient.users.getUser(clerkUserId);
  const primary = cu.primaryEmailAddress ?? cu.emailAddresses[0];
  const email = primary?.emailAddress ?? `${clerkUserId}@unknown.local`;
  const emailVerified = primary?.verification?.status === "verified";
  const meta = (cu.unsafeMetadata as Record<string, unknown> | undefined) ?? {};
  const metaName = typeof meta.name === "string" ? meta.name.trim() : "";
  const metaPhone = typeof meta.phone === "string" ? meta.phone.trim() : "";
  const name = metaName
    || [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim()
    || cu.username
    || email.split("@")[0];

  // Only link to a pre-existing local account if the Clerk email is verified.
  // Without this check, an attacker could sign up with a victim's unverified
  // email and inherit the victim's role and data.
  if (emailVerified) {
    const byEmail = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (byEmail.length) {
      const [linked] = await db.update(usersTable).set({ clerkUserId }).where(eq(usersTable.id, byEmail[0].id)).returning();
      return linked;
    }
  }

  const metaRole = meta.role ?? (cu.publicMetadata as Record<string, unknown> | undefined)?.role;
  const initialRole: "client" | "barber" = metaRole === "barber" ? "barber" : "client";

  const [created] = await db.insert(usersTable).values({
    clerkUserId,
    name,
    email,
    phone: metaPhone || null,
    role: initialRole,
    status: "active",
    avatarUrl: cu.imageUrl ?? null,
  }).returning();
  return created;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const user = await provisionUserFromClerk(clerkUserId);
    if (user.status === "suspended") { res.status(403).json({ error: "Account suspended" }); return; }
    req.clerkUserId = clerkUserId;
    req.localUser = user;
    next();
  } catch (err) {
    req.log?.error({ err }, "auth provisioning failed");
    res.status(500).json({ error: "Auth failed" });
  }
}

export function requireRole(...roles: Array<"client" | "barber" | "admin">) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.localUser) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!roles.includes(req.localUser.role)) { res.status(403).json({ error: "Forbidden" }); return; }
    next();
  };
}

// requireAdmin was removed when admin auth migrated to JWT (see lib/adminAuth.ts).
// Use requireAdminAuth from "../lib/adminAuth" instead.

export async function requireApprovedBarber(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.localUser || req.localUser.role !== "barber") { res.status(403).json({ error: "Barber account required" }); return; }
  const [barber] = await db.select().from(barbersTable).where(eq(barbersTable.userId, req.localUser.id)).limit(1);
  if (!barber) { res.status(403).json({ error: "Barber profile not created" }); return; }
  if (barber.status !== "approved") { res.status(403).json({ error: "Barber not approved", status: barber.status }); return; }
  (req as AuthedRequest & { barberId: number }).barberId = barber.id;
  next();
}

export async function getMyBarber(userId: number) {
  const [b] = await db.select().from(barbersTable).where(eq(barbersTable.userId, userId)).limit(1);
  return b ?? null;
}
