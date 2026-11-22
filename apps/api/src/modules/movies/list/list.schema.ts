import { Type, type Static } from "@sinclair/typebox";
const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Number(), Type.Null()]);
export const MovieCardSchema = Type.Object({ slug: Type.String(), title: Type.String(), releaseDate: nullableString,
  releaseYear: nullableNumber, runtimeMinutes: nullableNumber, posterImageUrl: nullableString,
  posterAttribution: Type.Union([Type.Object({ sourceUrl: Type.String(), artist: nullableString, license: Type.String(), licenseUrl: nullableString,
    provider: Type.Optional(Type.Union([Type.Literal("commons"), Type.Literal("wikipedia")])),
    rightsKind: Type.Optional(Type.Literal("reusable")) }), Type.Null()]) });
export const ListMoviesQuerySchema = Type.Object({ page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })), q: Type.Optional(Type.String({ maxLength: 140 })) });
export const MovieRankingSchema = Type.Object({ mode: Type.Union([Type.Literal("wikipedia_interest"), Type.Literal("combined_popularity"), Type.Literal("tmdb_popularity"), Type.Literal("netflix_views"), Type.Literal("recognition"), Type.Literal("alphabetical")]),
  sourceDate: nullableString, sourceUrl: nullableString, isFresh: Type.Boolean(), windowDays: Type.Optional(Type.Literal(3)), sources: Type.Optional(Type.Array(Type.Object({
    provider: Type.Union([Type.Literal("tmdb"), Type.Literal("netflix"), Type.Literal("wikipedia")]), sourceDate: Type.String(),
    windowStart: Type.String(), expiresAt: Type.String(), sourceUrl: Type.String(), observedCount: Type.Number(), matchedCount: Type.Number(),
  }))) });
export const ListMoviesResponseSchema = Type.Object({ items: Type.Array(MovieCardSchema), total: Type.Number(), page: Type.Number(), limit: Type.Number(), totalPages: Type.Number(), ranking: MovieRankingSchema });
export type MovieCard = Static<typeof MovieCardSchema>;
export type ListMoviesQuery = Static<typeof ListMoviesQuerySchema>;
export type ListMoviesResponse = Static<typeof ListMoviesResponseSchema>;
