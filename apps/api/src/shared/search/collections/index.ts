import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";

/**
 * Search is English-only: every entity has a single collection holding the
 * default (untranslated) content. The `_en` suffix is kept from the former
 * per-language layout so existing collections stay valid without a rename.
 */
export const SEARCH_COLLECTIONS = {
  games: "games_en",
  developers: "developers_en",
  publishers: "publishers_en",
  genres: "genres_en",
  platforms: "platforms_en",
  themes: "themes_en",
  posts: "posts_en",
} as const;

/** Collections left over from the removed Turkish index; `search:reindex --drop` deletes them. */
export const LEGACY_SEARCH_COLLECTIONS: readonly string[] = Object.keys(SEARCH_COLLECTIONS).map((base) => `${base}_tr`);

export function buildGamesCollectionSchema(): CollectionCreateSchema {
  return {
    name: SEARCH_COLLECTIONS.games,
    fields: [
      { name: "id", type: "string" },
      { name: "slug", type: "string", facet: true },
      { name: "title", type: "string" },
      { name: "originalTitle", type: "string", optional: true },
      { name: "description", type: "string", optional: true },
      { name: "coverImageUrl", type: "string", optional: true },
      { name: "releaseDate", type: "string", optional: true, facet: true },
      { name: "metacriticScore", type: "int32", optional: true },
      { name: "openCriticScore", type: "int32", optional: true },
      { name: "criticScore", type: "int32", optional: true },
      { name: "criticScoreCount", type: "int32", optional: true },
      // 0-1 blended popularity; the public list's default sort. Unknown scores hold
      // POPULARITY_UNKNOWN (-1) so they always sort after every scored game.
      { name: "popularityScore", type: "float", optional: true, sort: true },
      // Release date as unix seconds, for the public list's "released" filter and
      // newest-first sort. Unknown dates hold RELEASE_UNKNOWN so they sort last.
      { name: "releaseTimestamp", type: "int64" },
      { name: "hltbMainHours", type: "string", optional: true },
      { name: "hltbMainExtraHours", type: "string", optional: true },
      { name: "hltbCompletionistHours", type: "string", optional: true },
      { name: "developerIds", type: "string[]", optional: true },
      { name: "developerNames", type: "string[]", facet: true, optional: true },
      { name: "developerSlugs", type: "string[]", optional: true },
      { name: "publisherIds", type: "string[]", optional: true },
      { name: "publisherNames", type: "string[]", facet: true, optional: true },
      { name: "publisherSlugs", type: "string[]", optional: true },
      { name: "genreIds", type: "string[]", optional: true },
      { name: "genreNames", type: "string[]", facet: true, optional: true },
      { name: "genreSlugs", type: "string[]", optional: true },
      { name: "platformIds", type: "string[]", optional: true },
      { name: "platformNames", type: "string[]", facet: true, optional: true },
      { name: "platformSlugs", type: "string[]", optional: true },
      { name: "themeIds", type: "string[]", optional: true },
      { name: "themeNames", type: "string[]", facet: true, optional: true },
      { name: "themeSlugs", type: "string[]", optional: true },
      { name: "createdAt", type: "int64" },
      { name: "updatedAt", type: "int64", optional: true },
    ],
    default_sorting_field: "createdAt",
  };
}

export function buildDevelopersCollectionSchema(): CollectionCreateSchema {
  return {
    name: SEARCH_COLLECTIONS.developers,
    fields: [
      { name: "id", type: "string" },
      { name: "name", type: "string" },
      { name: "slug", type: "string", facet: true },
      { name: "countryCode", type: "string", optional: true, facet: true },
      { name: "createdAt", type: "int64" },
      { name: "updatedAt", type: "int64", optional: true },
    ],
    default_sorting_field: "createdAt",
  };
}

export function buildPublishersCollectionSchema(): CollectionCreateSchema {
  return {
    name: SEARCH_COLLECTIONS.publishers,
    fields: [
      { name: "id", type: "string" },
      { name: "name", type: "string" },
      { name: "slug", type: "string", facet: true },
      { name: "countryCode", type: "string", optional: true, facet: true },
      { name: "createdAt", type: "int64" },
      { name: "updatedAt", type: "int64", optional: true },
    ],
    default_sorting_field: "createdAt",
  };
}

export function buildGenresCollectionSchema(): CollectionCreateSchema {
  return {
    name: SEARCH_COLLECTIONS.genres,
    fields: [
      { name: "id", type: "string" },
      { name: "name", type: "string" },
      { name: "slug", type: "string", facet: true },
      { name: "createdAt", type: "int64" },
      { name: "updatedAt", type: "int64", optional: true },
    ],
    default_sorting_field: "createdAt",
  };
}

export function buildPlatformsCollectionSchema(): CollectionCreateSchema {
  return {
    name: SEARCH_COLLECTIONS.platforms,
    fields: [
      { name: "id", type: "string" },
      { name: "name", type: "string" },
      { name: "slug", type: "string", facet: true },
      { name: "createdAt", type: "int64" },
      { name: "updatedAt", type: "int64", optional: true },
    ],
    default_sorting_field: "createdAt",
  };
}

export function buildThemesCollectionSchema(): CollectionCreateSchema {
  return {
    name: SEARCH_COLLECTIONS.themes,
    fields: [
      { name: "id", type: "string" },
      { name: "name", type: "string" },
      { name: "slug", type: "string", facet: true },
      { name: "createdAt", type: "int64" },
      { name: "updatedAt", type: "int64", optional: true },
    ],
    default_sorting_field: "createdAt",
  };
}

export function buildPostsCollectionSchema(): CollectionCreateSchema {
  return {
    name: SEARCH_COLLECTIONS.posts,
    fields: [
      { name: "id", type: "string" },
      { name: "slug", type: "string", facet: true },
      { name: "title", type: "string" },
      { name: "excerpt", type: "string", optional: true },
      { name: "content", type: "string", optional: true },
      { name: "coverImageUrl", type: "string", optional: true },
      { name: "seoTitle", type: "string", optional: true },
      { name: "seoDescription", type: "string", optional: true },
      { name: "authorUsername", type: "string", optional: true },
      { name: "authorDisplayName", type: "string", optional: true },
      { name: "publishedAt", type: "int64" },
      { name: "createdAt", type: "int64" },
      { name: "updatedAt", type: "int64", optional: true },
    ],
    default_sorting_field: "publishedAt",
  };
}

export function buildAllCollectionSchemas(): CollectionCreateSchema[] {
  return [
    buildGamesCollectionSchema(),
    buildDevelopersCollectionSchema(),
    buildPublishersCollectionSchema(),
    buildGenresCollectionSchema(),
    buildPlatformsCollectionSchema(),
    buildThemesCollectionSchema(),
    buildPostsCollectionSchema(),
  ];
}
