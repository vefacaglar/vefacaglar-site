import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { tvSeries } from "./tv-series";

export const userTvSeriesPreferences = pgTable("user_tv_series_preferences", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seriesId: integer("series_id").notNull().references(() => tvSeries.id, { onDelete: "cascade" }),
  rating: integer("rating"),
  note: text("note"),
  ratingVersion: integer("rating_version").notNull().default(0),
  noteVersion: integer("note_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.seriesId] }),
  check("user_tv_series_preferences_rating_range", sql`${table.rating} between 1 and 10`),
  check("user_tv_series_preferences_note_length", sql`char_length(${table.note}) <= 2000`),
  check("user_tv_series_preferences_versions", sql`${table.ratingVersion} >= 0 and ${table.noteVersion} >= 0`),
]);
