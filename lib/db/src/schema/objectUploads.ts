import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Binds each uploaded object path to the user who requested its upload URL.
 * Used to prevent path-claiming: a user may only reference object paths they
 * uploaded themselves, so an attacker cannot submit someone else's private
 * document path (e.g. a financing ID document) to gain read access via the
 * reference-based storage ACL.
 */
export const objectUploadsTable = pgTable("object_uploads", {
  objectPath: text("object_path").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ObjectUpload = typeof objectUploadsTable.$inferSelect;
