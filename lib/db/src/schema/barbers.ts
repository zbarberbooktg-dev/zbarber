import { pgTable, serial, text, timestamp, integer, doublePrecision, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const barberStatusEnum = pgEnum("barber_status", ["pending", "approved", "rejected", "suspended"]);

export const barbersTable = pgTable("barbers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  salonName: text("salon_name").notNull(),
  bio: text("bio"),
  logoUrl: text("logo_url"),
  city: text("city").notNull(),
  neighborhood: text("neighborhood"),
  address: text("address"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  status: barberStatusEnum("status").notNull().default("pending"),
  profileViews: integer("profile_views").notNull().default(0),
  subscriptionPlanId: integer("subscription_plan_id"),
  rejectionReason: text("rejection_reason"),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBarberSchema = createInsertSchema(barbersTable).omit({ id: true, createdAt: true, profileViews: true });
export type InsertBarber = z.infer<typeof insertBarberSchema>;
export type Barber = typeof barbersTable.$inferSelect;
