import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";

export const THEMES_COLLECTION: CollectionCreateSchema = {
  name: "themes",
  fields: [
    { name: "id", type: "string" },
    { name: "name", type: "string" },
    { name: "slug", type: "string", facet: true },
    { name: "createdAt", type: "int64" },
    { name: "updatedAt", type: "int64", optional: true },
  ],
  default_sorting_field: "createdAt",
};
