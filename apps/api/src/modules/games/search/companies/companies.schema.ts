import { Type, type Static } from "@sinclair/typebox";

export const SearchCompaniesQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 100 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 24 })),
});
export type SearchCompaniesQuery = Static<typeof SearchCompaniesQuerySchema>;

export const CompanyMatchSchema = Type.Object({
  name: Type.String(),
  slug: Type.String(),
  gameCount: Type.Integer({ minimum: 1, description: "Games in this catalog linked to the company in this role" }),
});
export type CompanyMatch = Static<typeof CompanyMatchSchema>;

export const SearchCompaniesResponseSchema = Type.Object({
  developers: Type.Array(CompanyMatchSchema),
  publishers: Type.Array(CompanyMatchSchema),
});
export type SearchCompaniesResponse = Static<typeof SearchCompaniesResponseSchema>;
