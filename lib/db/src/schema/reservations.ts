import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { barbersTable } from "./barbers";
import { servicesTable } from "./services";

export const reservationStatusEnum = pgEnum("reservation_status", ["pending", "confirmed", "cancelled", "completed"]);

export const reservationsTable = pgTable("reservations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => usersTable.id),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: reservationStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReservationSchema = createInsertSchema(reservationsTable).omit({ id: true, createdAt: true });
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservationsTable.$inferSelect;
