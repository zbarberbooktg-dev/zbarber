import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conferencesTable = pgTable("conferences", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  participationChannel: text("participation_channel"),
  joinLink: text("join_link"),
  instructions: text("instructions"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConferenceSchema = createInsertSchema(conferencesTable).omit({ id: true, createdAt: true });
export type InsertConference = z.infer<typeof insertConferenceSchema>;
export type Conference = typeof conferencesTable.$inferSelect;
