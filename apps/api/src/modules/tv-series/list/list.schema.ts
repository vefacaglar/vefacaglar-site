import { Type, type Static } from "@sinclair/typebox";
export const NullableString = Type.Union([Type.String(), Type.Null()]);
export const NullableNumber = Type.Union([Type.Number(), Type.Null()]);
export const TvSeriesCardSchema = Type.Object({
  id: Type.Integer(), title: Type.String(), summary: NullableString,
  premiered: NullableString, ended: NullableString, status: NullableString,
  genres: Type.Array(Type.String()), rating: NullableNumber, ratingSource: Type.Literal("tvmaze"), sourceUrl: Type.String(),
  seasonCount: NullableNumber, episodeCount: NullableNumber, specialCount: NullableNumber,
});
export const TvRankingSchema = Type.Object({
  mode: Type.Union([Type.Literal("current_popularity"), Type.Literal("alphabetical")]),
  isFresh: Type.Boolean(), sources: Type.Array(Type.Object({
    provider: Type.String(), sourceDate: Type.String(), windowStart: Type.String(), expiresAt: Type.String(), sourceUrl: Type.String(),
  })),
});
export const ListTvSeriesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })),
  q: Type.Optional(Type.String({ maxLength: 140 })),
});
export const ListTvSeriesResponseSchema = Type.Object({
  items: Type.Array(TvSeriesCardSchema), total: Type.Integer(), page: Type.Integer(), limit: Type.Integer(), totalPages: Type.Integer(), ranking: TvRankingSchema,
});
export type TvSeriesCard = Static<typeof TvSeriesCardSchema>;
export type TvRanking = Static<typeof TvRankingSchema>;
export type ListTvSeriesQuery = Static<typeof ListTvSeriesQuerySchema>;
export type ListTvSeriesResponse = Static<typeof ListTvSeriesResponseSchema>;
