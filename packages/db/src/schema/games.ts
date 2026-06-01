import { pgTable, uuid, text, varchar, char, timestamp, decimal, integer, boolean, primaryKey, date, index } from 'drizzle-orm/pg-core';
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
  title: varchar('title', { length: 250 }).notNull(),
  originalTitle: varchar('original_title', { length: 250 }),
  description: text('description'),
  coverImageUrl: varchar('cover_image_url', { length: 1000 }),
  releaseDate: date('release_date'),
  metacriticScore: integer('metacritic_score'),
  openCriticScore: integer('open_critic_score'),
  hltbMainHours: decimal('hltb_main_hours', { precision: 6, scale: 1 }),
  hltbMainExtraHours: decimal('hltb_main_extra_hours', { precision: 6, scale: 1 }),
  hltbCompletionistHours: decimal('hltb_completionist_hours', { precision: 6, scale: 1 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
});

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
  rating: decimal('rating', { precision: 3, scale: 1 }),
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
