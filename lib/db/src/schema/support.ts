import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const supportLinksTable = pgTable("support_links", {
  id: integer("id").primaryKey(),
  whatsapp: text("whatsapp"),
  tiktok: text("tiktok"),
  instagram: text("instagram"),
  facebook: text("facebook"),
});

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  category: text("category", { enum: ["account", "booking", "salon", "other"] }).notNull(),
  subject: text("subject").notNull(),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("support_tickets_user_id_idx").on(t.userId, t.id)]);

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTicketsTable.id, { onDelete: "cascade" }),
  author: text("author", { enum: ["user", "admin"] }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("support_messages_ticket_id_idx").on(t.ticketId, t.id)]);

export const insertSupportLinksSchema = createInsertSchema(supportLinksTable);
export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportMessageSchema = createInsertSchema(supportMessagesTable).omit({ id: true, createdAt: true });
export type SupportTicketRecord = typeof supportTicketsTable.$inferSelect;
