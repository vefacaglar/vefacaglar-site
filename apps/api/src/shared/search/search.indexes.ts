/**
 * Stable Meilisearch index uids (primary key `id`). Search is English-only: each
 * entity has a single index holding the default (untranslated) content. The
 * worker creates the indexes, applies their settings and rebuilds them (with an
 * index swap, so the uid never changes); the API only queries them and writes
 * incremental document updates into indexes that already exist.
 */
export const SEARCH_INDEXES = {
  games: "games_en",
  developers: "developers_en",
  publishers: "publishers_en",
  genres: "genres_en",
  platforms: "platforms_en",
  themes: "themes_en",
  posts: "posts_en",
} as const;
