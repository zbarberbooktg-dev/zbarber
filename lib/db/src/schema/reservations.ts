import { pgTable, serial, text, timestamp, integer, boolean, doublePrecision, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { barbersTable } from "./barbers";
import { servicesTable } from "./services";

export const reservationStatusEnum = pgEnum("reservation_status", ["pending", "confirmed", "cancelled", "completed"]);

export const reservationsTable = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull().references(() => usersTable.id),
    barberId: integer("barber_id").notNull().references(() => barbersTable.id),
    serviceId: integer("service_id").notNull().references(() => servicesTable.id),
    scheduledAt: timestamp("scheduled_at").notNull(),
    status: reservationStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    // ── Home ("à domicile") service ──
    // When true, this booking is a home visit: the client provided a GPS location
    // and the server computed the travel distance + fee from the barber's zones.
    isHomeService: boolean("is_home_service").notNull().default(false),
    serviceLatitude: doublePrecision("service_latitude"),
    serviceLongitude: doublePrecision("service_longitude"),
    travelDistanceKm: doublePrecision("travel_distance_km"),
    // Extra travel fee (FC) charged on top of the service price, matched from the
    // barber's radius zones at booking time (frozen so later zone edits don't
    // retroactively change an existing reservation's price).
    travelFee: doublePrecision("travel_fee"),
    reminderSentAt: timestamp("reminder_sent_at"),
    // Claim marker for the post-appointment thank-you / review-invite email,
    // set once when the reservation transitions to "completed" so the email is
    // never sent twice even if the status is re-applied.
    thankYouSentAt: timestamp("thank_you_sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // Database-level guarantee against double-booking. Only ACTIVE reservations
    // (pending or confirmed) reserve the slot, so the unique index is partial:
    // cancelled/completed rows free the slot and can pile up without conflict.
    // Two concurrent POSTs racing the same slot can both pass the app-level
    // clash check, but only one insert survives this index — the loser gets a
    // unique-violation the route maps to a 409.
    activeSlotUniq: uniqueIndex("reservations_active_slot_uniq")
      .on(t.barberId, t.scheduledAt)
      .where(sql`${t.status} in ('pending', 'confirmed')`),
  }),
);

export const insertReservationSchema = createInsertSchema(reservationsTable).omit({ id: true, createdAt: true });
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservationsTable.$inferSelect;
