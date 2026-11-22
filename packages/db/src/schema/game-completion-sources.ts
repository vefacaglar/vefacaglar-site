import { pgTable, integer, varchar, text, timestamp, primaryKey, jsonb } from "drizzle-orm/pg-core";

// Independent, source-specific observations. These metrics are never copied
// into IGDB or legacy HLTB fields.
export const gameCompletionReports = pgTable("game_completion_reports", {
  igdbId: integer("igdb_id").notNull(),
  provider: varchar("provider", { length: 24 }).notNull(),
  externalId: varchar("external_id", { length: 180 }).notNull(),
  sourceUrl: text("source_url").notNull(),
  scope: text("scope").notNull(),
  statistic: varchar("statistic", { length: 32 }).notNull(),
  finishSeconds: integer("finish_seconds"),
  masterSeconds: integer("master_seconds"),
  playtimeSeconds: integer("playtime_seconds"),
  sampleCount: integer("sample_count"),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
  observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }),
  checkedAt: timestamp("checked_at", { withTimezone: true, mode: "date" }).notNull(),
  nextCheckAt: timestamp("next_check_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [primaryKey({ columns: [table.igdbId, table.provider] })]);

export const gameCompletionProviderState = pgTable("game_completion_provider_state", {
  provider: varchar("provider", { length: 24 }).primaryKey(),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true, mode: "date" }),
  errorCode: varchar("error_code", { length: 64 }),
  // Only verified numeric/canonical provider identifiers, never profile data.
  identityMap: jsonb("identity_map"),
  mapCheckedAt: timestamp("map_checked_at", { withTimezone: true, mode: "date" }),
});
