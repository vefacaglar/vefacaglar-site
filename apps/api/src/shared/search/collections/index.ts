import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import { GAMES_COLLECTION } from "./games.collection";
import { DEVELOPERS_COLLECTION } from "./developers.collection";
import { PUBLISHERS_COLLECTION } from "./publishers.collection";
import { GENRES_COLLECTION } from "./genres.collection";
import { PLATFORMS_COLLECTION } from "./platforms.collection";
import { THEMES_COLLECTION } from "./themes.collection";

export function buildAllCollectionSchemas(): CollectionCreateSchema[] {
  return [
    GAMES_COLLECTION,
    DEVELOPERS_COLLECTION,
    PUBLISHERS_COLLECTION,
    GENRES_COLLECTION,
    PLATFORMS_COLLECTION,
    THEMES_COLLECTION,
  ];
}

export const ALL_COLLECTION_NAMES = [
  GAMES_COLLECTION.name,
  DEVELOPERS_COLLECTION.name,
  PUBLISHERS_COLLECTION.name,
  GENRES_COLLECTION.name,
  PLATFORMS_COLLECTION.name,
  THEMES_COLLECTION.name,
] as const;
