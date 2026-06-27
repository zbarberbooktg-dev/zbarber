import { pgTable, serial, text, timestamp, pgEnum, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["client", "barber", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "pending"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("client"),
  status: userStatusEnum("status").notNull().default("active"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  city: text("city"),
  country: text("country"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationUpdatedAt: timestamp("location_updated_at"),
  // Claim marker for the "come back and book" re-engagement push. Set when a
  // re-engagement push is sent and reset to NULL whenever the client books, so
  // a returning client becomes eligible again after their next quiet stretch.
  lastReengagementAt: timestamp("last_reengagement_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
