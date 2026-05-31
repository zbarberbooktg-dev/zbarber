import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { barbersTable } from "./barbers";

// 360° equirectangular panorama scenes for a salon's virtual tour.
// A barber can have multiple scenes (rooms) navigable from the salon page.
export const panoramasTable = pgTable("panoramas", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPanoramaSchema = createInsertSchema(panoramasTable).omit({ id: true, createdAt: true });
export type InsertPanorama = z.infer<typeof insertPanoramaSchema>;
export type Panorama = typeof panoramasTable.$inferSelect;
