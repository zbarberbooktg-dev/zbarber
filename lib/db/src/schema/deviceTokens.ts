import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// One row per physical device → Expo push token. The token is globally unique:
// if a device is re-used by a different account, the existing row is re-pointed
// to the new userId (upsert on the token), so a token never delivers a push to
// the wrong (previous) account.
export const deviceTokensTable = pgTable("device_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDeviceTokenSchema = createInsertSchema(deviceTokensTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeviceToken = z.infer<typeof insertDeviceTokenSchema>;
export type DeviceToken = typeof deviceTokensTable.$inferSelect;
