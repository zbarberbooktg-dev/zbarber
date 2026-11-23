import { boolean, integer, pgTable, serial, timestamp, uuid } from "drizzle-orm/pg-core";
import { barbersTable } from "./barbers";

export const salonAdsTable = pgTable("salon_ads", {
  id: serial("id").primaryKey(),
  salonId: integer("salon_id").notNull().references(() => barbersTable.id, { onDelete: "cascade" }),
  videoKey: uuid("video_key").notNull().unique(),
  byteCount: integer("byte_count").notNull(),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Populated in the same transaction that detaches a video; survives restarts.
export const salonAdVideoCleanupTable = pgTable("salon_ad_video_cleanup", {
  videoKey: uuid("video_key").primaryKey(),
  retryAfter: timestamp("retry_after", { withTimezone: true }).notNull().defaultNow(),
});
