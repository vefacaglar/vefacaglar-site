import { pgTable, integer, text, varchar, timestamp, date, boolean, doublePrecision, jsonb, primaryKey, index, unique, foreignKey } from "drizzle-orm/pg-core";

export const tvSeries = pgTable("tv_series", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  summary: text("summary"),
  premiered: date("premiered"), ended: date("ended"),
  firstAired: date("first_aired"), lastAired: date("last_aired"),
  status: text("status"), type: text("type"), language: text("language"),
  runtime: integer("runtime"), averageRuntime: integer("average_runtime"),
  network: text("network"), webChannel: text("web_channel"),
  rating: doublePrecision("rating"), sourceUrl: text("source_url").notNull(), officialSite: text("official_site"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  hierarchyComplete: boolean("hierarchy_complete").notNull().default(false),
  hierarchyUpdatedAt: timestamp("hierarchy_updated_at", { withTimezone: true, mode: "date" }),
  seasonCount: integer("season_count").notNull().default(0),
  episodeCount: integer("episode_count").notNull().default(0),
  specialCount: integer("special_count").notNull().default(0),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  popularityScore: doublePrecision("popularity_score"),
  popularityGeneration: integer("popularity_generation").notNull().default(0),
}, (table) => [index("tv_series_popularity_idx").on(table.popularityScore, table.id), index("tv_series_hydration_idx").on(table.hierarchyComplete, table.id)]);

export const tvGenres = pgTable("tv_genres", { name: varchar("name", { length: 120 }).primaryKey() });
export const tvSeriesGenres = pgTable("tv_series_genres", {
  seriesId: integer("series_id").notNull().references(() => tvSeries.id, { onDelete: "cascade" }),
  genreName: varchar("genre_name", { length: 120 }).notNull().references(() => tvGenres.name, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.seriesId, table.genreName] })]);

export const tvSeasons = pgTable("tv_seasons", {
  id: integer("id").primaryKey(), seriesId: integer("series_id").notNull().references(() => tvSeries.id, { onDelete: "cascade" }),
  number: integer("number"), name: text("name"), summary: text("summary"),
  premiered: date("premiered"), ended: date("ended"), episodeOrder: integer("episode_order"),
  network: text("network"), sourceUrl: text("source_url").notNull(),
}, (table) => [index("tv_seasons_series_idx").on(table.seriesId), unique("tv_seasons_identity_idx").on(table.id, table.seriesId)]);

export const tvEpisodes = pgTable("tv_episodes", {
  id: integer("id").primaryKey(), seriesId: integer("series_id").notNull().references(() => tvSeries.id, { onDelete: "cascade" }),
  seasonId: integer("season_id"), seasonNumber: integer("season_number"), number: integer("number"),
  name: text("name"), summary: text("summary"), type: varchar("type", { length: 40 }).notNull(),
  isSpecial: boolean("is_special").notNull(), airdate: date("airdate"),
  airstamp: timestamp("airstamp", { withTimezone: true, mode: "date" }),
  runtime: integer("runtime"), rating: doublePrecision("rating"), sourceUrl: text("source_url").notNull(),
}, (table) => [index("tv_episodes_series_idx").on(table.seriesId), index("tv_episodes_season_idx").on(table.seasonId),
  foreignKey({ columns: [table.seasonId, table.seriesId], foreignColumns: [tvSeasons.id, tvSeasons.seriesId], name: "tv_episodes_season_series_fk" })]);

export const tvSourceState = pgTable("tv_source_state", {
  id: varchar("id", { length: 32 }).primaryKey(), nextPage: integer("next_page").notNull().default(0),
  indexComplete: boolean("index_complete").notNull().default(false),
  indexStartedAt: timestamp("index_started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  catalogCompletedAt: timestamp("catalog_completed_at", { withTimezone: true, mode: "date" }),
  updatesCheckedAt: timestamp("updates_checked_at", { withTimezone: true, mode: "date" }),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true, mode: "date" }),
});
export const tvRefreshQueue = pgTable("tv_refresh_queue", {
  seriesId: integer("series_id").primaryKey(), priority: integer("priority").notNull().default(0),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  failureCount: integer("failure_count").notNull().default(0), errorCode: varchar("error_code", { length: 64 }),
}, (table) => [index("tv_refresh_queue_due_idx").on(table.dueAt, table.priority, table.seriesId)]);

export const tvPopularityState = pgTable("tv_popularity_state", {
  id: varchar("id", { length: 32 }).primaryKey(), generation: integer("generation").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  sources: jsonb("sources").notNull().default([]),
  identityMap: jsonb("identity_map"), identitiesCheckedAt: timestamp("identities_checked_at", { withTimezone: true, mode: "date" }),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true, mode: "date" }),
});
export const tvPopularityScores = pgTable("tv_popularity_scores", {
  seriesId: integer("series_id").primaryKey(), score: doublePrecision("score").notNull(),
  generation: integer("generation").notNull(),
});

export const tvSearchState = pgTable("tv_search_state", {
  id: varchar("id", { length: 32 }).primaryKey(), schemaVersion: integer("schema_version").notNull().default(1),
  phase: varchar("phase", { length: 24 }).notNull().default("scan"), scanCursor: integer("scan_cursor"),
  rankingReady: boolean("ranking_ready").notNull().default(false), publishedGeneration: integer("published_generation").notNull().default(0),
  buildIndex: text("build_index"), buildToken: varchar("build_token", { length: 64 }), pendingGeneration: integer("pending_generation"),
});
export const tvSearchDirty = pgTable("tv_search_dirty", {
  seriesId: integer("series_id").primaryKey().references(() => tvSeries.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(1),
});
