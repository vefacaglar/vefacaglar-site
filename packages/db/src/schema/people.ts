import { sql } from "drizzle-orm";
import { pgTable, uuid, varchar, text, timestamp, date, primaryKey, unique, check, index } from "drizzle-orm/pg-core";
import { moviePeople } from "./movies";
/** Provider identities extend the existing shared person; this is not a second person entity. */
export const moviePersonSources = pgTable("movie_person_sources", {
  provider: varchar("provider", { length: 32 }).notNull(), externalId: varchar("external_id", { length: 64 }).notNull(),
  personId: uuid("person_id").notNull().references(() => moviePeople.id),
  sourceUrl: text("source_url").notNull(), sourceName: text("source_name"),
  birthDate: date("birth_date"), deathDate: date("death_date"), gender: text("gender"), country: text("country"),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }).notNull(),
  identityMethod: varchar("identity_method", { length: 32 }),
  verifiedWikidataId: varchar("verified_wikidata_id", { length: 24 }),
  identityCheckedAt: timestamp("identity_checked_at", { withTimezone: true, mode: "date" }),
}, (table) => [primaryKey({ columns: [table.provider, table.externalId] }), unique("movie_person_sources_owner_idx").on(table.provider, table.personId)]);
/** Former public UUIDs remain resolvable after an exact provider identity merge. */
export const moviePersonAliases = pgTable("movie_person_aliases", {
  aliasId: uuid("alias_id").primaryKey().references(() => moviePeople.id),
  personId: uuid("person_id").notNull().references(() => moviePeople.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("movie_person_aliases_target_idx").on(table.personId), check("movie_person_aliases_not_self", sql`${table.aliasId}<>${table.personId}`)]);
