import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { barbersTable } from "./barbers";
import { servicesTable } from "./services";

export const walkInStatusEnum = pgEnum("walk_in_status", ["waiting", "in_progress", "done", "cancelled"]);

export const walkInQueueTable = pgTable("walk_in_queue", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id),
  serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  status: walkInStatusEnum("status").notNull().default("waiting"),
  position: integer("position").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWalkInSchema = createInsertSchema(walkInQueueTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWalkIn = z.infer<typeof insertWalkInSchema>;
export type WalkIn = typeof walkInQueueTable.$inferSelect;
