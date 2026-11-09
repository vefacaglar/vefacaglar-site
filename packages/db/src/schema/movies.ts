import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, varchar, integer, doublePrecision, boolean, timestamp, jsonb, primaryKey, index, bigint, date, check } from 'drizzle-orm/pg-core';

export const movies = pgTable('movies', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikidataId: varchar('wikidata_id', { length: 24 }).notNull().unique(),
  imdbId: varchar('imdb_id', { length: 16 }).unique(),
  imdbConflict: boolean('imdb_conflict').notNull().default(false),
  slug: varchar('slug', { length: 250 }).notNull().unique(),
  title: text('title'),
  originalTitle: text('original_title'),
  description: text('description'),
  posterFileName: text('poster_file_name'),
  enwikiArticle: text('enwiki_article'),
  // Wikidata P373 Commons category name (without the "Category:" prefix).
  commonsCategory: text('commons_category'),
  posterInputsCheckedAt: timestamp('poster_inputs_checked_at', { withTimezone: true, mode: 'date' }),
  posterCandidateVersion: integer('poster_candidate_version').notNull().default(0),
  posterResolvedFileName: text('poster_resolved_file_name'),
  posterResolvedFrom: varchar('poster_resolved_from', { length: 16 }),
  posterImageUrl: text('poster_image_url'),
  posterAttribution: jsonb('poster_attribution').$type<{ provider?: 'commons' | 'wikipedia'; rightsKind?: 'reusable' | 'non-free'; sourceUrl: string; artist: string | null; license: string; licenseUrl: string | null; articleTitle?: string }>(),
  posterCheckedAt: timestamp('poster_checked_at', { withTimezone: true, mode: 'date' }),
  posterRetryAfter: timestamp('poster_retry_after', { withTimezone: true, mode: 'date' }),
  posterErrorCode: varchar('poster_error_code', { length: 80 }),
  // Admin takedown: when set, the poster image and its credit are never shown publicly and artwork jobs skip the film.
  posterBlockedAt: timestamp('poster_blocked_at', { withTimezone: true, mode: 'date' }),
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
  // General recognition proxy: distinct Wikipedia editions, not a rating.
  wikipediaLanguageCount: integer('wikipedia_language_count'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  wikipediaLanguageCountCheck: check('movies_wikipedia_language_count_check', sql`${table.wikipediaLanguageCount} is null or (${table.wikipediaLanguageCount} >= 0 and ${table.wikipediaLanguageCount} < 1000000)`),
  recognitionBackfillIdx: index('movies_recognition_backfill_idx').on(table.id)
    .where(sql`${table.wikipediaLanguageCount} is null and ${table.isFilm} = true and ${table.hydratedAt} is not null and ${table.title} is not null`),
  publicTitleIdx: index('movies_public_title_idx').on(table.title, table.id)
    .where(sql`${table.isFilm} = true and ${table.hydratedAt} is not null and ${table.title} is not null`),
  searchIdx: index('movies_title_search_idx').using('gin', sql`to_tsvector('simple', coalesce(${table.title}, ''))`),
  hydrationIdx: index('movies_hydration_idx').on(table.hydratedAt, table.seedPriority, table.retryAfter, table.createdAt),
  refreshIdx: index('movies_refresh_idx').on(table.checkedAt, table.id),
  posterRefreshIdx: index('movies_poster_refresh_idx').on(table.posterRetryAfter, table.posterCheckedAt, table.id)
    .where(sql`${table.posterFileName} is not null and ${table.isFilm} = true`),
  wikipediaPosterRefreshIdx: index('movies_wikipedia_poster_refresh_idx').on(table.posterRetryAfter, table.posterCheckedAt, table.id)
    .where(sql`${table.enwikiArticle} is not null and ${table.isFilm} = true`),
  commonsCategoryPosterRefreshIdx: index('movies_commons_category_poster_refresh_idx').on(table.posterRetryAfter, table.posterCheckedAt, table.id)
    .where(sql`${table.commonsCategory} is not null and ${table.isFilm} = true`),
  posterInputsIdx: index('movies_poster_inputs_idx').on(table.posterInputsCheckedAt, table.id)
    .where(sql`${table.isFilm} = true and ${table.hydratedAt} is not null`),
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
  artworkCooldownUntil: timestamp('artwork_cooldown_until', { withTimezone: true, mode: 'date' }),
  wikipediaArtworkCooldownUntil: timestamp('wikipedia_artwork_cooldown_until', { withTimezone: true, mode: 'date' }),
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

/** Dedicated movie search ownership and durable bootstrap/ranking publication. */
export const movieSearchState = pgTable('movie_search_state', {
  id: text('id').primaryKey(),
  schemaVersion: integer('schema_version').notNull().default(1),
  activeCollection: text('active_collection'),
  buildingCollection: text('building_collection'),
  bootstrapPhase: text('bootstrap_phase').notNull().default('scan'),
  bootstrapCursor: uuid('bootstrap_cursor'),
  rankingGeneration: bigint('ranking_generation', { mode: 'number' }).notNull().default(0),
  rankingReady: boolean('ranking_ready').notNull().default(false),
  publishedSourceDate: date('published_source_date'),
  repairCursor: uuid('repair_cursor'),
  repairCompletedAt: timestamp('repair_completed_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/** No FK: acknowledged tombstones survive hard deletion for bounded reconciliation. */
export const movieSearchSync = pgTable('movie_search_sync', {
  movieId: uuid('movie_id').primaryKey(),
  requestedRevision: bigint('requested_revision', { mode: 'number' }).notNull().default(1),
  appliedRevision: bigint('applied_revision', { mode: 'number' }).notNull().default(0),
  indexedCollection: text('indexed_collection'),
  dirtyAt: timestamp('dirty_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  pendingIdx: index('movie_search_sync_pending_idx').on(table.movieId)
    .where(sql`${table.requestedRevision} > ${table.appliedRevision}`),
}));
