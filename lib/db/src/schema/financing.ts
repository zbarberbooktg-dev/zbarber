import { pgTable, serial, text, timestamp, integer, doublePrecision, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { barbersTable } from "./barbers";

export const financingPurposeEnum = pgEnum("financing_purpose", ["renovation", "tools", "products", "other"]);
export const financingStatusEnum = pgEnum("financing_status", ["pending", "reviewing", "approved", "rejected"]);

export const financingRequestsTable = pgTable("financing_requests", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id),
  amount: doublePrecision("amount").notNull(),
  purpose: financingPurposeEnum("purpose").notNull(),
  description: text("description").notNull(),
  status: financingStatusEnum("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFinancingRequestSchema = createInsertSchema(financingRequestsTable).omit({ id: true, createdAt: true, adminNote: true });
export type InsertFinancingRequest = z.infer<typeof insertFinancingRequestSchema>;
export type FinancingRequest = typeof financingRequestsTable.$inferSelect;
