import { pgTable, uuid, text, varchar, char, timestamp, decimal, integer, boolean, primaryKey, date, index, doublePrecision, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

// Game Status Enum Values
export const gameStatusEnum = ['backlog', 'playing', 'completed', 'on_hold', 'abandoned'] as const;
export type GameStatus = typeof gameStatusEnum[number];

// Ownership Type Enum Values
export const ownershipTypeEnum = ['physical', 'digital', 'subscription', 'other'] as const;
export type OwnershipType = typeof ownershipTypeEnum[number];

// Play Style Enum Values
export const playStyleEnum = ['main_story', 'main_extra', 'completionist', 'casual'] as const;
export type PlayStyle = typeof playStyleEnum[number];

// 1. Games (Global catalog record)
export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 180 }).notNull().unique(),
  // IGDB's game id, set by catalog:import; null for hand-entered games not yet matched.
  igdbId: integer('igdb_id').unique(),
  title: varchar('title', { length: 250 }).notNull(),
  originalTitle: varchar('original_title', { length: 250 }),
  description: text('description'),
  coverImageUrl: varchar('cover_image_url', { length: 1000 }),
  releaseDate: date('release_date'),
  metacriticScore: integer('metacritic_score'),
  openCriticScore: integer('open_critic_score'),
  // IGDB's aggregated critic rating (0-100) and how many critic reviews it averages.
  criticScore: integer('critic_score'),
  criticScoreCount: integer('critic_score_count'),
  // IGDB's total_rating_count (user + critic ratings), refreshed on every import.
  igdbRatingCount: integer('igdb_rating_count'),
  // 0-1 blend of popularity signals, computed by the popularity refresh; null when the game has none.
  popularityScore: doublePrecision('popularity_score'),
  popularityUpdatedAt: timestamp('popularity_updated_at', { withTimezone: true, mode: 'date' }),
  // Owner-taste recommendation, separate from current interest. Filled by the catalog refresh.
  recommendationScore: doublePrecision('recommendation_score'),
  recommendationVersion: varchar('recommendation_version', { length: 64 }),
  recommendationUpdatedAt: timestamp('recommendation_updated_at', { withTimezone: true, mode: 'date' }),
  // null = unchecked; [] = checked with no known modes; IGDB 1 = single player.
  gameModeIds: integer('game_mode_ids').array(),
  // Last complete mode lookup attempt; an omitted game keeps its modes unknown/unchanged.
  gameModesCheckedAt: timestamp('game_modes_checked_at', { withTimezone: true, mode: 'date' }),
  hltbMainHours: decimal('hltb_main_hours', { precision: 6, scale: 1 }),
  hltbMainExtraHours: decimal('hltb_main_extra_hours', { precision: 6, scale: 1 }),
  hltbCompletionistHours: decimal('hltb_completionist_hours', { precision: 6, scale: 1 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  // Public games list order (Postgres fallback when search is down).
  releaseDateTitleIdx: index('games_release_date_title_idx').on(table.releaseDate.desc().nullsLast(), table.title),
  // Public games list "popular" order (Postgres fallback when search is down).
  popularityScoreIdx: index('games_popularity_score_idx').on(
    table.popularityScore.desc().nullsLast(),
    table.releaseDate.desc().nullsLast(),
    table.title
  ),
  recommendationScoreIdx: index('games_recommendation_score_idx').on(
    table.recommendationScore.desc().nullsLast(),
    table.popularityScore.desc().nullsLast(),
    table.title,
    table.id
  ),
  gameModesRefreshIdx: index('games_game_modes_refresh_idx').on(table.gameModesCheckedAt, table.id),
  // Dashboard games list order.
  createdAtIdIdx: index('games_created_at_id_idx').on(table.createdAt.desc().nullsFirst(), table.id),
}));

// 2. Developers
export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 180 }).notNull(),
  slug: varchar('slug', { length: 180 }).notNull().unique(),
  countryCode: char('country_code', { length: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
});

// 3. Publishers
export const publishers = pgTable('publishers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 180 }).notNull(),
  slug: varchar('slug', { length: 180 }).notNull().unique(),
  countryCode: char('country_code', { length: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
});

// 4. Genres
export const genres = pgTable('genres', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
});

// 5. Platforms
export const platforms = pgTable('platforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
});

// 6. Themes
export const themes = pgTable('themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
});

// 7. UserGames (Personal user relationship with game)
export const userGames = pgTable('user_games', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  status: text('status', { enum: gameStatusEnum }).notNull(),
  // 0-100
  rating: integer('rating'),
  reviewText: text('review_text'),
  notes: text('notes'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  platformId: uuid('platform_id')
    .references(() => platforms.id, { onDelete: 'set null' }),
  ownershipType: text('ownership_type', { enum: ownershipTypeEnum }),
  purchaseSource: varchar('purchase_source', { length: 120 }),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),
  currency: char('currency', { length: 3 }),
  startedAt: date('started_at'),
  completedAt: date('completed_at'),
  lastPlayedAt: date('last_played_at'),
  playtimeHours: decimal('playtime_hours', { precision: 7, scale: 1 }),
  completionCount: integer('completion_count').notNull().default(0),
  difficulty: varchar('difficulty', { length: 80 }),
  playStyle: text('play_style', { enum: playStyleEnum }),
  finishedMainStory: boolean('finished_main_story').notNull().default(false),
  finishedDlc: boolean('finished_dlc').notNull().default(false),
  finishedCompletionist: boolean('finished_completionist').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  userIdIdx: index('user_games_user_id_idx').on(table.userId),
  gameIdIdx: index('user_games_game_id_idx').on(table.gameId),
  userIdStatusIdx: index('user_games_user_id_status_idx').on(table.userId, table.status),
}));

// 8. UserGamePlaytimeEntries (append-only audit of playtime increases on a play log)
// Only increases are recorded: deltaHours is always > 0; decreases/corrections leave no entry.
export const userGamePlaytimeEntries = pgTable('user_game_playtime_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userGameId: uuid('user_game_id')
    .notNull()
    .references(() => userGames.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  status: text('status', { enum: gameStatusEnum }).notNull().default('playing'),
  deltaHours: decimal('delta_hours', { precision: 7, scale: 1 }).notNull(),
  // Null when the entry comes from the log's first recorded playtime.
  previousHours: decimal('previous_hours', { precision: 7, scale: 1 }),
  newHours: decimal('new_hours', { precision: 7, scale: 1 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  userIdRecordedAtIdx: index('user_game_playtime_entries_user_id_recorded_at_idx').on(table.userId, table.recordedAt),
  userGameIdIdx: index('user_game_playtime_entries_user_game_id_idx').on(table.userGameId),
}));

// --- Join Tables ---

// GameDevelopers
export const gameDevelopers = pgTable('game_developers', {
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  developerId: uuid('developer_id')
    .notNull()
    .references(() => developers.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.developerId] }),
  // The PK only serves game -> developers; this serves developer -> games and cascade deletes.
  developerIdIdx: index('game_developers_developer_id_idx').on(table.developerId),
}));

// GamePublishers
export const gamePublishers = pgTable('game_publishers', {
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  publisherId: uuid('publisher_id')
    .notNull()
    .references(() => publishers.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.publisherId] }),
  publisherIdIdx: index('game_publishers_publisher_id_idx').on(table.publisherId),
}));

// GameGenres
export const gameGenres = pgTable('game_genres', {
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  genreId: uuid('genre_id')
    .notNull()
    .references(() => genres.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.genreId] }),
}));

// GamePlatforms
export const gamePlatforms = pgTable('game_platforms', {
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.platformId] }),
  platformIdIdx: index('game_platforms_platform_id_idx').on(table.platformId),
}));

// GameThemes
export const gameThemes = pgTable('game_themes', {
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => themes.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.themeId] }),
}));

// --- TS Inference Types ---
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type UserGame = typeof userGames.$inferSelect;
export type NewUserGame = typeof userGames.$inferInsert;

export type UserGamePlaytimeEntry = typeof userGamePlaytimeEntries.$inferSelect;
export type NewUserGamePlaytimeEntry = typeof userGamePlaytimeEntries.$inferInsert;

export type Developer = typeof developers.$inferSelect;
export type NewDeveloper = typeof developers.$inferInsert;

export type Publisher = typeof publishers.$inferSelect;
export type NewPublisher = typeof publishers.$inferInsert;

export type Genre = typeof genres.$inferSelect;
export type NewGenre = typeof genres.$inferInsert;

export type Platform = typeof platforms.$inferSelect;
export type NewPlatform = typeof platforms.$inferInsert;

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;

// Raw IGDB popularity primitives per game, one row per popularity type (e.g. 4 = Played).
// Values are only comparable within one type; the blended score lives on games.popularity_score.
export const gamePopularitySignals = pgTable('game_popularity_signals', {
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  popularityType: integer('popularity_type').notNull(),
  value: doublePrecision('value').notNull(),
  calculatedAt: timestamp('calculated_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.popularityType] }),
}));

// Optional HowLongToBeat engagement snapshots. Missing counts are unknown, not zero.
export const gameHltbPopularity = pgTable('game_hltb_popularity', {
  gameId: uuid('game_id').primaryKey().references(() => games.id, { onDelete: 'cascade' }),
  hltbId: integer('hltb_id').notNull().unique(),
  completed: integer('completed'),
  backlog: integer('backlog'),
  playing: integer('playing'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
  mappingSource: text('mapping_source').notNull().default('imported'),
  mappingVerifiedAt: timestamp('mapping_verified_at', { withTimezone: true, mode: 'date' }),
});

// One bounded, replaceable search receipt per game; never a second HLTB mapping.
export const gameHltbLookups = pgTable('game_hltb_lookups', {
  gameId: uuid('game_id').primaryKey().references(() => games.id, { onDelete: 'cascade' }),
  receiptId: uuid('receipt_id').notNull().unique(),
  query: varchar('query', { length: 250 }).notNull(),
  expectedVersion: text('expected_version').notNull(),
  candidates: jsonb('candidates').$type<unknown[]>().notNull(),
  outcome: text('outcome').notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'date' }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  retryAfter: timestamp('retry_after', { withTimezone: true, mode: 'date' }),
  failureCount: integer('failure_count').notNull().default(0),
  pendingSearchSync: boolean('pending_search_sync').notNull().default(false),
  syncVersion: uuid('sync_version'),
});

// Shared API/CLI/worker website request permit and provider cooldown.
export const hltbProviderState = pgTable('hltb_provider_state', {
  id: text('id').primaryKey(),
  leaseOwner: uuid('lease_owner'),
  leaseUntil: timestamp('lease_until', { withTimezone: true, mode: 'date' }),
  nextRequestAt: timestamp('next_request_at', { withTimezone: true, mode: 'date' }).notNull(),
  cooldownUntil: timestamp('cooldown_until', { withTimezone: true, mode: 'date' }),
});
