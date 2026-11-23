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
