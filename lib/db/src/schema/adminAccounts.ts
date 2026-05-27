import { pgTable, serial, text, timestamp, pgEnum, integer, boolean, type AnyPgColumn } from "drizzle-orm/pg-core";

export const adminStatusEnum = pgEnum("admin_status", ["active", "suspended"]);

export const adminAccountsTable = pgTable("admin_accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isRoot: boolean("is_root").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  status: adminStatusEnum("status").notNull().default("active"),
  invitedByAdminId: integer("invited_by_admin_id").references((): AnyPgColumn => adminAccountsTable.id, { onDelete: "set null" }),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminAccount = typeof adminAccountsTable.$inferSelect;
export type InsertAdminAccount = typeof adminAccountsTable.$inferInsert;
