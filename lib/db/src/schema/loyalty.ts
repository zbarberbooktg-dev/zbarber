import { pgTable, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { barbersTable } from "./barbers";

// Each row records one redeemed free cut (loyalty reward) for a (client, barber) pair.
// Free cuts earned = floor(completedReservations / LOYALTY_THRESHOLD).
// Free cuts available = earned - count(redemptions).
export const loyaltyRedemptionsTable = pgTable("loyalty_redemptions", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLoyaltyRedemptionSchema = createInsertSchema(loyaltyRedemptionsTable).omit({ id: true, createdAt: true });
export type InsertLoyaltyRedemption = z.infer<typeof insertLoyaltyRedemptionSchema>;
export type LoyaltyRedemption = typeof loyaltyRedemptionsTable.$inferSelect;
