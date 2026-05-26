import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const countriesTable = pgTable("countries", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  dialCode: text("dial_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const citiesTable = pgTable(
  "cities",
  {
    id: serial("id").primaryKey(),
    countryId: integer("country_id").notNull().references(() => countriesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqCountryName: uniqueIndex("cities_country_name_lower_uniq").on(t.countryId, sql`lower(${t.name})`),
  }),
);

export const insertCountrySchema = createInsertSchema(countriesTable).omit({ id: true, createdAt: true });
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Country = typeof countriesTable.$inferSelect;

export const insertCitySchema = createInsertSchema(citiesTable).omit({ id: true, createdAt: true });
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof citiesTable.$inferSelect;
