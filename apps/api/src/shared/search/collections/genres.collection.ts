import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import type { SearchLanguage } from "../search-indexer.interface";

export function buildGenresCollectionSchema(lang: SearchLanguage): CollectionCreateSchema {
  return {
    name: `genres_${lang}`,
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
