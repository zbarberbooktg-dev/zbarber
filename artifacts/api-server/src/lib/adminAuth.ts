import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db, adminAccountsTable, type AdminAccount } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "./clerkAuth";

export const ADMIN_COOKIE_NAME = "gbc_admin";
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getJwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET or SESSION_SECRET must be set");
  return secret;
}

interface AdminJwtPayload {
  sub: number;
  v: number; // schema version — bump to invalidate all tokens
}

export function signAdminToken(adminId: number): string {
  return jwt.sign({ sub: adminId, v: 1 } satisfies AdminJwtPayload, getJwtSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

export function verifyAdminToken(token: string): AdminJwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as unknown as AdminJwtPayload;
    if (typeof decoded?.sub !== "number" || decoded.v !== 1) return null;
    return { sub: decoded.sub, v: decoded.v };
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Generate a cryptographically strong random password (URL-safe, ~16 chars).
 * Format: 4 groups of 4 lowercase alphanumerics separated by dashes — easy to
 * read and copy out of an email.
 */
export function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no l, o, 0, 1 for legibility
  const arr = new Uint8Array(16);
  globalThis.crypto.getRandomValues(arr);
  const chars = Array.from(arr, (n) => alphabet[n % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12), chars.slice(12, 16)]
    .map((g) => g.join(""))
    .join("-");
}

export function setAdminCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
}

export interface AdminAuthedRequest extends Request {
  admin?: AdminAccount;
}

/**
 * Internal: resolve a request's admin from the cookie, if any. Does not
 * write the response. Returns null when no valid admin session exists.
 * NOTE: admin auth is strictly cookie-based — Authorization Bearer tokens
 * are NOT accepted for admin routes (clients are first-party only).
 */
async function resolveAdminFromCookie(req: Request): Promise<AdminAccount | null> {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const token = cookies?.[ADMIN_COOKIE_NAME];
  if (!token) return null;
  const decoded = verifyAdminToken(token);
  if (!decoded) return null;
  const [admin] = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.id, decoded.sub)).limit(1);
  if (!admin || admin.status !== "active") return null;
  return admin;
}

export async function requireAdminAuth(
  req: AdminAuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const admin = await resolveAdminFromCookie(req);
  if (!admin) { res.status(401).json({ error: "Admin auth required" }); return; }
  req.admin = admin;
  next();
}

/**
 * Hybrid guard for endpoints used by BOTH self-managed admins (cookie JWT)
 * AND first-party Clerk users (clients/barbers). Tries admin auth first;
 * on success, sets `req.admin`. Otherwise falls through to Clerk
 * `requireAuth`, which sets `req.localUser`. Handlers should branch on
 * `req.admin ?? req.localUser` accordingly.
 */
export async function requireAuthOrAdmin(
  req: AdminAuthedRequest & AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const admin = await resolveAdminFromCookie(req);
  if (admin) { req.admin = admin; next(); return; }
  return requireAuth(req, res, next);
}

export function sanitizeAdmin(a: AdminAccount): Omit<AdminAccount, "passwordHash"> {
  const { passwordHash: _ph, ...rest } = a;
  return rest;
}
