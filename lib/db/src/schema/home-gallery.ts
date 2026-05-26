import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const homeGalleryPhotosTable = pgTable("home_gallery_photos", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHomeGalleryPhotoSchema = createInsertSchema(homeGalleryPhotosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHomeGalleryPhoto = z.infer<typeof insertHomeGalleryPhotoSchema>;
export type HomeGalleryPhoto = typeof homeGalleryPhotosTable.$inferSelect;
