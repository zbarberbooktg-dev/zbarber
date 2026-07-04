import { pgTable, serial, integer, boolean, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { barbersTable } from "./barbers";

// Weekly availability windows for the home ("à domicile") service. Kept separate
// from the in-salon `schedules` table because a barber may offer home visits on
// different days/times than the salon's opening hours.
export const homeServiceHoursTable = pgTable("home_service_hours", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id, { onDelete: "cascade" }),
  day: text("day").notNull(), // mon..sun
  isAvailable: boolean("is_available").notNull().default(false),
  startTime: text("start_time"),
  endTime: text("end_time"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Distance-tiered travel-fee zones. Each row = "up to maxRadiusKm from the salon,
// the travel fee is `fee` (FC)". A client's straight-line distance from the salon
// is matched to the SMALLEST zone whose maxRadiusKm >= distance. A distance beyond
// the largest zone is out of range (the barber does not travel there).
export const homeServiceZonesTable = pgTable("home_service_zones", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id, { onDelete: "cascade" }),
  maxRadiusKm: doublePrecision("max_radius_km").notNull(),
  fee: doublePrecision("fee").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type HomeServiceHours = typeof homeServiceHoursTable.$inferSelect;
export type HomeServiceZone = typeof homeServiceZonesTable.$inferSelect;
