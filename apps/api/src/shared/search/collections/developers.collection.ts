import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import type { SearchLanguage } from "../search-indexer.interface";

export function buildDevelopersCollectionSchema(lang: SearchLanguage): CollectionCreateSchema {
  return {
    name: `developers_${lang}`,
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
