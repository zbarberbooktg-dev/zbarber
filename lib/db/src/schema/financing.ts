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
  monthlyRevenue: doublePrecision("monthly_revenue").notNull().default(0),
  yearsActive: integer("years_active").notNull().default(0),
  repaymentMonths: integer("repayment_months").notNull().default(6),
  documents: text("documents").array().notNull().default([]),
  status: financingStatusEnum("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFinancingRequestSchema = createInsertSchema(financingRequestsTable).omit({ id: true, createdAt: true, adminNote: true, status: true, reviewedAt: true });
export type InsertFinancingRequest = z.infer<typeof insertFinancingRequestSchema>;
export type FinancingRequest = typeof financingRequestsTable.$inferSelect;
