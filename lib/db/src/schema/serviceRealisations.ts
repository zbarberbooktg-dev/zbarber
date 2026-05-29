import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { barbersTable } from "./barbers";
import { servicesTable } from "./services";

// Before/after photos showcasing a barber's work, optionally tied to a service.
export const serviceRealisationsTable = pgTable("service_realisations", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  beforeUrl: text("before_url").notNull(),
  afterUrl: text("after_url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertServiceRealisationSchema = createInsertSchema(serviceRealisationsTable).omit({ id: true, createdAt: true });
export type InsertServiceRealisation = z.infer<typeof insertServiceRealisationSchema>;
export type ServiceRealisation = typeof serviceRealisationsTable.$inferSelect;
