import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import type { SearchLanguage } from "../search-indexer.interface";

export function buildGamesCollectionSchema(lang: SearchLanguage): CollectionCreateSchema {
  return {
    name: `games_${lang}`,
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
