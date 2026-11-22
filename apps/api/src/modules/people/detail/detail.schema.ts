import { Type, type Static } from "@sinclair/typebox";
const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Integer(), Type.Null()]);
export const PersonParamsSchema = Type.Object({ id: Type.String({ format: "uuid" }) });
export const PersonQuerySchema = Type.Object({ page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })) });
const creditFields = {
  title: Type.String(), releaseYear: nullableNumber,
  roles: Type.Array(Type.Union([Type.Literal("cast"), Type.Literal("director"), Type.Literal("producer")])),
  characters: Type.Array(Type.String()), voice: Type.Boolean(), self: Type.Boolean(),
};
export const PersonCreditSchema = Type.Union([
  Type.Object({ ...creditFields, kind: Type.Literal("film"), id: Type.String(), slug: Type.String() }),
  Type.Object({ ...creditFields, kind: Type.Literal("tv_series"), id: Type.Integer() }),
]);
export const PersonPageSchema = Type.Object({
  person: Type.Object({ id: Type.String(), name: Type.String(), wikidataId: nullableString,
    birthDate: nullableString, deathDate: nullableString, gender: nullableString, country: nullableString,
    sources: Type.Array(Type.Object({ provider: Type.Literal("tvmaze"), sourceUrl: Type.String() })) }),
  items: Type.Array(PersonCreditSchema), total: Type.Integer(), page: Type.Integer(), limit: Type.Integer(), totalPages: Type.Integer(),
});
export type PersonParams = Static<typeof PersonParamsSchema>;
export type PersonQuery = Static<typeof PersonQuerySchema>;
export type PersonCredit = Static<typeof PersonCreditSchema>;
export type PersonPage = Static<typeof PersonPageSchema>;
