import { pgTable, serial, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";

export const deletionRequestStatusEnum = pgEnum("deletion_request_status", ["pending", "processed", "rejected"]);

export const accountDeletionRequestsTable = pgTable("account_deletion_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  reason: text("reason"),
  userId: integer("user_id"),
  status: deletionRequestStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export type AccountDeletionRequest = typeof accountDeletionRequestsTable.$inferSelect;
