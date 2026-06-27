import { pgTable, serial, text, timestamp, integer, doublePrecision, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Status lifecycle (two-step validation):
//  pending           → freshly registered, awaiting the admin's FIRST validation
//  awaiting_document  → first-validated; barber has 30 days to upload an official
//                       authorization document, then the admin reviews it
//  approved           → document reviewed & accepted; account fully verified
//  rejected           → admin refused the registration
//  suspended          → admin suspended an active account
export const barberStatusEnum = pgEnum("barber_status", ["pending", "awaiting_document", "approved", "rejected", "suspended"]);

export const barbersTable = pgTable("barbers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  salonName: text("salon_name").notNull(),
  bio: text("bio"),
  logoUrl: text("logo_url"),
  country: text("country"),
  city: text("city").notNull(),
  neighborhood: text("neighborhood"),
  address: text("address"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  status: barberStatusEnum("status").notNull().default("pending"),
  profileViews: integer("profile_views").notNull().default(0),
  subscriptionPlanId: integer("subscription_plan_id"),
  rejectionReason: text("rejection_reason"),
  suspensionReason: text("suspension_reason"),
  // ── Two-step validation: professional authorization document ──
  // Timestamp of the admin's first validation (starts the 30-day window).
  firstValidatedAt: timestamp("first_validated_at"),
  // Object-storage path of the uploaded official document (null until submitted).
  documentUrl: text("document_url"),
  // When the barber submitted (last submitted) their document.
  documentSubmittedAt: timestamp("document_submitted_at"),
  // Deadline (firstValidatedAt + 30 days) by which a document must be submitted.
  documentDeadline: timestamp("document_deadline"),
  // Admin note explaining why a submitted document was marked non-conforming.
  documentReviewNote: text("document_review_note"),
  // Highest document-deadline reminder stage already sent (claim-then-send marker):
  //  0 = none, 1 = "7 days left" reminder, 2 = "1 day left" reminder.
  // Prevents duplicate reminder emails/pushes across overlapping scheduler sweeps.
  documentReminderStage: integer("document_reminder_stage").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBarberSchema = createInsertSchema(barbersTable).omit({ id: true, createdAt: true, profileViews: true });
export type InsertBarber = z.infer<typeof insertBarberSchema>;
export type Barber = typeof barbersTable.$inferSelect;
