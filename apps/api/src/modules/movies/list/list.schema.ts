import { Type, type Static } from "@sinclair/typebox";
const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Number(), Type.Null()]);
export const MovieCardSchema = Type.Object({ slug: Type.String(), title: Type.String(), releaseDate: nullableString,
  releaseYear: nullableNumber, runtimeMinutes: nullableNumber, posterImageUrl: nullableString,
  posterAttribution: Type.Union([Type.Object({ sourceUrl: Type.String(), artist: nullableString, license: Type.String(), licenseUrl: nullableString,
    provider: Type.Optional(Type.Union([Type.Literal("commons"), Type.Literal("wikipedia")])),
    rightsKind: Type.Optional(Type.Union([Type.Literal("reusable"), Type.Literal("non-free")])) }), Type.Null()]) });
export const ListMoviesQuerySchema = Type.Object({ page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })), q: Type.Optional(Type.String({ maxLength: 140 })) });
export const MovieRankingSchema = Type.Object({ mode: Type.Union([Type.Literal("wikipedia_interest"), Type.Literal("alphabetical")]),
  sourceDate: nullableString, sourceUrl: nullableString, isFresh: Type.Boolean() });
export const ListMoviesResponseSchema = Type.Object({ items: Type.Array(MovieCardSchema), total: Type.Number(), page: Type.Number(), limit: Type.Number(), totalPages: Type.Number(), ranking: MovieRankingSchema });
export type MovieCard = Static<typeof MovieCardSchema>;
export type ListMoviesQuery = Static<typeof ListMoviesQuerySchema>;
export type ListMoviesResponse = Static<typeof ListMoviesResponseSchema>;
