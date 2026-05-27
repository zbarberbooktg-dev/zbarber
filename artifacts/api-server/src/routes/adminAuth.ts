import { Router } from "express";
import { z } from "zod";
import { db, adminAccountsTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import {
  signAdminToken,
  setAdminCookie,
  clearAdminCookie,
  hashPassword,
  verifyPassword,
  generatePassword,
  requireAdminAuth,
  sanitizeAdmin,
  type AdminAuthedRequest,
} from "../lib/adminAuth";
import { sendEmail, isSmtpConfigured } from "../lib/email";

const router = Router();

router.post("/admin-auth/login", async (req, res) => {
  const body = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Email et mot de passe requis" }); return; }

  const email = body.data.email.trim().toLowerCase();
  const [admin] = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.email, email)).limit(1);
  if (!admin || admin.status !== "active") {
    res.status(401).json({ error: "Identifiants invalides" }); return;
  }
  const ok = await verifyPassword(body.data.password, admin.passwordHash);
  if (!ok) { res.status(401).json({ error: "Identifiants invalides" }); return; }

  await db.update(adminAccountsTable)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminAccountsTable.id, admin.id));

  const token = signAdminToken(admin.id);
  setAdminCookie(res, token);
  // Cookie-only — never return the raw JWT in the body. This keeps the
  // bearer token out of XSS reach and away from client-side storage.
  res.json({ admin: sanitizeAdmin(admin) });
});

router.post("/admin-auth/logout", async (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get("/admin-auth/me", requireAdminAuth, async (req: AdminAuthedRequest, res) => {
  res.json({ admin: sanitizeAdmin(req.admin!) });
});

router.post("/admin-auth/change-password", requireAdminAuth, async (req: AdminAuthedRequest, res) => {
  const body = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "Au moins 8 caractères"),
  }).safeParse(req.body);
  if (!body.success) {
    const issue = body.error.issues[0]?.message ?? "Entrée invalide";
    res.status(400).json({ error: issue }); return;
  }
  const me = req.admin!;
  const ok = await verifyPassword(body.data.currentPassword, me.passwordHash);
  if (!ok) { res.status(400).json({ error: "Mot de passe actuel incorrect" }); return; }
  if (body.data.newPassword === body.data.currentPassword) {
    res.status(400).json({ error: "Le nouveau mot de passe doit être différent" }); return;
  }
  const newHash = await hashPassword(body.data.newPassword);
  await db.update(adminAccountsTable)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(adminAccountsTable.id, me.id));
  res.json({ ok: true });
});

router.get("/admin-auth/admins", requireAdminAuth, async (_req, res) => {
  const rows = await db.select().from(adminAccountsTable).orderBy(adminAccountsTable.createdAt);
  res.json(rows.map(sanitizeAdmin));
});

router.post("/admin-auth/invite", requireAdminAuth, async (req: AdminAuthedRequest, res) => {
  const body = z.object({
    email: z.string().email(),
    name: z.string().min(2),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Email et nom requis" }); return; }

  const email = body.data.email.trim().toLowerCase();
  const [existing] = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.email, email)).limit(1);
  if (existing) { res.status(409).json({ error: "Un admin avec cet email existe déjà" }); return; }

  const tempPassword = generatePassword();
  const passwordHash = await hashPassword(tempPassword);

  const [created] = await db.insert(adminAccountsTable).values({
    email,
    name: body.data.name,
    passwordHash,
    isRoot: false,
    mustChangePassword: true,
    status: "active",
    invitedByAdminId: req.admin!.id,
  }).returning();

  const subject = "Invitation à la console admin Global Barber Corp";
  const text = `Bonjour ${body.data.name},

Vous avez été invité(e) à la console d'administration Global Barber Corp par ${req.admin!.name}.

Vos identifiants temporaires :
  Email      : ${email}
  Mot de passe : ${tempPassword}

Connectez-vous : ${process.env.ADMIN_LOGIN_URL || ""}

Pour des raisons de sécurité, vous devrez changer ce mot de passe à votre première connexion.`;

  const { delivered } = await sendEmail({ to: email, subject, text });

  res.json({
    admin: sanitizeAdmin(created),
    emailDelivered: delivered,
    // Surface the temporary password to the inviting admin ONLY when SMTP is
    // not configured, so dev/testing isn't blocked. In production with SMTP,
    // the password is delivered exclusively via email.
    tempPassword: delivered ? undefined : tempPassword,
    smtpConfigured: isSmtpConfigured(),
  });
});

router.patch("/admin-auth/admins/:id/suspend", requireAdminAuth, async (req: AdminAuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  if (id === req.admin!.id) { res.status(400).json({ error: "Impossible de se suspendre soi-même" }); return; }
  const [target] = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "Admin introuvable" }); return; }
  if (target.isRoot) { res.status(400).json({ error: "Impossible de suspendre l'admin root" }); return; }
  const [updated] = await db.update(adminAccountsTable)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(adminAccountsTable.id, id))
    .returning();
  res.json(sanitizeAdmin(updated));
});

router.patch("/admin-auth/admins/:id/reactivate", requireAdminAuth, async (req: AdminAuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  const [updated] = await db.update(adminAccountsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(adminAccountsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Admin introuvable" }); return; }
  res.json(sanitizeAdmin(updated));
});

router.delete("/admin-auth/admins/:id", requireAdminAuth, async (req: AdminAuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  if (id === req.admin!.id) { res.status(400).json({ error: "Impossible de se supprimer soi-même" }); return; }
  const [target] = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "Admin introuvable" }); return; }
  if (target.isRoot) { res.status(400).json({ error: "Impossible de supprimer l'admin root" }); return; }
  await db.delete(adminAccountsTable).where(eq(adminAccountsTable.id, id));
  res.json({ ok: true });
});

// Silence unused import (kept for future "list all non-self admins" queries)
void and;
void ne;

export default router;
