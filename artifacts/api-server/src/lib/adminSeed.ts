import { db, adminAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./adminAuth";
import { logger } from "./logger";

/**
 * Ensure a root admin exists. Run once at startup. Idempotent.
 *
 * - If ADMIN_ROOT_EMAIL + ADMIN_ROOT_PASSWORD are set and no root admin exists,
 *   one is created with mustChangePassword=true.
 * - If a root admin already exists, this is a no-op (we do NOT overwrite the
 *   password on every startup — once the root changes their password, the env
 *   var becomes irrelevant).
 */
export async function ensureRootAdmin(): Promise<void> {
  const [existingRoot] = await db
    .select()
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.isRoot, true))
    .limit(1);
  if (existingRoot) return;

  const email = process.env.ADMIN_ROOT_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_ROOT_PASSWORD;
  if (!email || !password) {
    logger.warn(
      "No root admin found and ADMIN_ROOT_EMAIL / ADMIN_ROOT_PASSWORD env vars not set. " +
        "Admin dashboard will be inaccessible until the root admin is seeded.",
    );
    return;
  }
  if (password.length < 8) {
    logger.error("ADMIN_ROOT_PASSWORD must be at least 8 characters");
    return;
  }

  // Refuse to overwrite an existing non-root account that already holds the
  // seed email — otherwise the seeder would silently swallow the conflict
  // and report success while no root admin exists.
  const [conflict] = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.email, email)).limit(1);
  if (conflict) {
    logger.error(
      { email },
      "ADMIN_ROOT_EMAIL is already used by a non-root admin account. " +
        "Either change ADMIN_ROOT_EMAIL or remove the conflicting account. " +
        "No root admin will be seeded.",
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.insert(adminAccountsTable).values({
    email,
    passwordHash,
    name: "Root Admin",
    isRoot: true,
    mustChangePassword: true,
    status: "active",
  });

  logger.info({ email }, "Root admin seeded — change password on first login");
}
