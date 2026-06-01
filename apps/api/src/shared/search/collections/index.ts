import { buildGamesCollectionSchema } from "./games.collection";
import { buildDevelopersCollectionSchema } from "./developers.collection";
import { buildPublishersCollectionSchema } from "./publishers.collection";
import { buildGenresCollectionSchema } from "./genres.collection";
import { buildPlatformsCollectionSchema } from "./platforms.collection";
import { buildThemesCollectionSchema } from "./themes.collection";
import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import type { SearchLanguage } from "../search-indexer.interface";

export const LANGUAGES: SearchLanguage[] = ["en", "tr"];

export function buildAllCollectionSchemas(): CollectionCreateSchema[] {
  const schemas: CollectionCreateSchema[] = [];
  for (const lang of LANGUAGES) {
    schemas.push(buildGamesCollectionSchema(lang));
    schemas.push(buildDevelopersCollectionSchema(lang));
    schemas.push(buildPublishersCollectionSchema(lang));
    schemas.push(buildGenresCollectionSchema(lang));
    schemas.push(buildPlatformsCollectionSchema(lang));
    schemas.push(buildThemesCollectionSchema(lang));
  }
  return schemas;
}

export const COLLECTION_NAME_BUILDERS = {
  games: buildGamesCollectionSchema,
  developers: buildDevelopersCollectionSchema,
  publishers: buildPublishersCollectionSchema,
  genres: buildGenresCollectionSchema,
  platforms: buildPlatformsCollectionSchema,
  themes: buildThemesCollectionSchema,
} as const;
