import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { barbersTable } from "./barbers";

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  isWorking: boolean("is_working").notNull().default(true),
  startTime: text("start_time"),
  endTime: text("end_time"),
  breakStart: text("break_start"),
  breakEnd: text("break_end"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const daysOffTable = pgTable("days_off", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
});

export type Schedule = typeof schedulesTable.$inferSelect;
export type DayOff = typeof daysOffTable.$inferSelect;
