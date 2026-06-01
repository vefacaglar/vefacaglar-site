import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";

export const DEVELOPERS_COLLECTION: CollectionCreateSchema = {
  name: "developers",
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
