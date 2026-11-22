import { pgTable, integer, uuid, text, boolean, timestamp, varchar, jsonb, primaryKey, index } from "drizzle-orm/pg-core";
import { moviePeople } from "./movies";
import { tvSeries } from "./tv-series";
export const tvCast = pgTable("tv_cast", {
  seriesId: integer("series_id").notNull().references(() => tvSeries.id, { onDelete: "cascade" }),
  personId: uuid("person_id").notNull().references(() => moviePeople.id),
  characterId: integer("character_id").notNull(), characterName: text("character_name"), characterSourceUrl: text("character_source_url").notNull(),
  castOrder: integer("cast_order").notNull(), self: boolean("self"), voice: boolean("voice"),
  sourceUrl: text("source_url").notNull(), fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [primaryKey({ columns: [table.seriesId, table.personId, table.characterId] }), index("tv_cast_person_idx").on(table.personId)]);
export const tvCastQueue = pgTable("tv_cast_queue", {
  seriesId: integer("series_id").primaryKey().references(() => tvSeries.id, { onDelete: "cascade" }),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  failureCount: integer("failure_count").notNull().default(0), errorCode: varchar("error_code", { length: 64 }),
}, (table) => [index("tv_cast_queue_due_idx").on(table.dueAt, table.requestedAt, table.seriesId)]);
export const tvCastState = pgTable("tv_cast_state", {
  id: varchar("id", { length: 32 }).primaryKey(),
  identityMap: jsonb("identity_map"), identitiesCheckedAt: timestamp("identities_checked_at", { withTimezone: true, mode: "date" }),
});
