import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, varchar, integer, doublePrecision, boolean, timestamp, jsonb, primaryKey, index, bigint, date } from 'drizzle-orm/pg-core';

export const movies = pgTable('movies', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikidataId: varchar('wikidata_id', { length: 24 }).notNull().unique(),
  imdbId: varchar('imdb_id', { length: 16 }).unique(),
  imdbConflict: boolean('imdb_conflict').notNull().default(false),
  slug: varchar('slug', { length: 250 }).notNull().unique(),
  title: text('title'),
  originalTitle: text('original_title'),
  description: text('description'),
  releaseDate: text('release_date'),
  releaseYear: integer('release_year'),
  releasePrecision: integer('release_precision'),
  runtimeMinutes: doublePrecision('runtime_minutes'),
  isFilm: boolean('is_film').notNull().default(false),
  sourceRevision: bigint('source_revision', { mode: 'number' }),
  sourceModifiedAt: timestamp('source_modified_at', { withTimezone: true, mode: 'date' }),
  hydratedAt: timestamp('hydrated_at', { withTimezone: true, mode: 'date' }),
  checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'date' }),
  retryAfter: timestamp('retry_after', { withTimezone: true, mode: 'date' }),
  failureCount: integer('failure_count').notNull().default(0),
  errorCode: varchar('error_code', { length: 80 }),
  seedPriority: integer('seed_priority').notNull().default(0),
  // Sparse English Wikipedia top-article observations; null means unobserved.
  wikipediaViews: integer('wikipedia_views'),
  wikipediaSourceDate: date('wikipedia_source_date'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  publicTitleIdx: index('movies_public_title_idx').on(table.title, table.id)
    .where(sql`${table.isFilm} = true and ${table.hydratedAt} is not null and ${table.title} is not null`),
  searchIdx: index('movies_title_search_idx').using('gin', sql`to_tsvector('simple', coalesce(${table.title}, ''))`),
  hydrationIdx: index('movies_hydration_idx').on(table.hydratedAt, table.seedPriority, table.retryAfter, table.createdAt),
  refreshIdx: index('movies_refresh_idx').on(table.checkedAt, table.id),
}));

export const moviePeople = pgTable('movie_people', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikidataId: varchar('wikidata_id', { length: 24 }).notNull().unique(),
  name: text('name'),
  labelCheckedAt: timestamp('label_checked_at', { withTimezone: true, mode: 'date' }),
});
export const movieCompanies = pgTable('movie_companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikidataId: varchar('wikidata_id', { length: 24 }).notNull().unique(),
  name: text('name'),
  labelCheckedAt: timestamp('label_checked_at', { withTimezone: true, mode: 'date' }),
});
export const movieGenres = pgTable('movie_genres', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikidataId: varchar('wikidata_id', { length: 24 }).notNull().unique(),
  name: text('name'),
  slug: varchar('slug', { length: 250 }).notNull().unique(),
  labelCheckedAt: timestamp('label_checked_at', { withTimezone: true, mode: 'date' }),
});
export const movieEntityLabels = pgTable('movie_entity_labels', {
  wikidataId: varchar('wikidata_id', { length: 24 }).primaryKey(),
  name: text('name'),
  checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const movieCredits = pgTable('movie_credits', {
  movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').notNull().references(() => moviePeople.id),
  statementId: text('statement_id').notNull(),
  roleProperty: varchar('role_property', { length: 8 }).notNull(),
  rank: varchar('rank', { length: 16 }).notNull(),
  qualifiers: jsonb('qualifiers').$type<Record<string, unknown>>().notNull().default({}),
  characterNames: text('character_names').array().notNull().default(sql`'{}'::text[]`),
}, (table) => ({ pk: primaryKey({ columns: [table.movieId, table.statementId] }), personIdx: index('movie_credits_person_idx').on(table.personId) }));
export const movieCompanyLinks = pgTable('movie_company_links', {
  movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => movieCompanies.id),
}, (table) => ({ pk: primaryKey({ columns: [table.movieId, table.companyId] }) }));
export const movieGenreLinks = pgTable('movie_genre_links', {
  movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  genreId: uuid('genre_id').notNull().references(() => movieGenres.id),
}, (table) => ({ pk: primaryKey({ columns: [table.movieId, table.genreId] }) }));

/** Provider-global progress survives new job ids. Never marks bootstrap complete before a validated discovery EOF. */
export const movieSourceState = pgTable('movie_source_state', {
  id: text('id').primaryKey(),
  discoveryStrategy: text('discovery_strategy'),
  discoveryCycle: integer('discovery_cycle').notNull().default(0),
  discoveryComplete: boolean('discovery_complete').notNull().default(false),
  nextDiscoveryAt: timestamp('next_discovery_at', { withTimezone: true, mode: 'date' }),
  refreshCursor: uuid('refresh_cursor'),
  cooldownUntil: timestamp('cooldown_until', { withTimezone: true, mode: 'date' }),
  failureCount: integer('failure_count').notNull().default(0),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/** The accepted complete projection and independent AQS retry diagnostics. */
export const moviePopularityState = pgTable('movie_popularity_state', {
  id: text('id').primaryKey(),
  sourceDate: date('source_date'),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  cooldownUntil: timestamp('cooldown_until', { withTimezone: true, mode: 'date' }),
  failureCount: integer('failure_count').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'date' }),
  errorCode: varchar('error_code', { length: 80 }),
  articleCount: integer('article_count'),
  mappedArticleCount: integer('mapped_article_count'),
  missingArticleCount: integer('missing_article_count'),
  duplicateQidCount: integer('duplicate_qid_count'),
  observedMovieCount: integer('observed_movie_count'),
});
