import { Type, type Static } from "@sinclair/typebox";

const NullableString = Type.Union([Type.String(), Type.Null()]);
export const MovieCommunityParamsSchema = Type.Object({ slug: Type.String({ minLength: 1, maxLength: 250 }) });
export const MovieCommunityQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 1_000_000 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
});
export const MovieCommunityEntrySchema = Type.Object({
  id: Type.String(),
  author: Type.Object({ username: Type.String(), displayName: Type.String() }),
  sharedAt: Type.String(),
  text: NullableString,
  rating: Type.Union([Type.Number({ minimum: 1, maximum: 10 }), Type.Null()]),
  watchedOn: Type.String(),
});
export const MovieCommunitySchema = Type.Object({
  rating: Type.Object({
    average: Type.Union([Type.Number({ minimum: 0, maximum: 10 }), Type.Null()]),
    count: Type.Integer({ minimum: 0 }),
    scale: Type.Literal(10),
  }),
  entries: Type.Array(MovieCommunityEntrySchema),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type MovieCommunityParams = Static<typeof MovieCommunityParamsSchema>;
export type MovieCommunityQuery = Static<typeof MovieCommunityQuerySchema>;
export type MovieCommunityEntry = Static<typeof MovieCommunityEntrySchema>;
export type MovieCommunity = Static<typeof MovieCommunitySchema>;
