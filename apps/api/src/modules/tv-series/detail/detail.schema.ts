import { Type, type Static } from "@sinclair/typebox";
import { NullableNumber, NullableString, TvSeriesCardSchema } from "../list/list.schema";
import { TvEpisodeSchema } from "../tv-episode.schema";
export const HierarchyStatusSchema = Type.Union([Type.Literal("pending"), Type.Literal("complete")]);
export const TvSeasonSummarySchema = Type.Object({
  id: Type.Integer(), number: NullableNumber, name: NullableString, summary: NullableString, episodeOrder: NullableNumber, network: NullableString, premiered: NullableString, ended: NullableString,
  episodeCount: NullableNumber, specialCount: NullableNumber,
});
export const TvCastRoleSchema = Type.Object({
  characterId: Type.Integer(), name: NullableString, self: Type.Union([Type.Boolean(), Type.Null()]),
  voice: Type.Union([Type.Boolean(), Type.Null()]), order: Type.Integer(),
});
export const TvCastPersonSchema = Type.Object({
  personId: Type.String(), name: NullableString, roles: Type.Array(TvCastRoleSchema), sourceUrl: Type.String(),
});
export const GetTvSeriesParamsSchema = Type.Object({ id: Type.Integer({ minimum: 1, maximum: 2147483647 }) });
export const TvSeriesDetailSchema = Type.Intersect([TvSeriesCardSchema, Type.Object({
  language: NullableString, type: NullableString, runtimeMinutes: NullableNumber, officialSite: NullableString,
  network: NullableString, firstAired: NullableString, lastAired: NullableString, updatedAt: Type.String(), hierarchyUpdatedAt: NullableString,
  castStatus: HierarchyStatusSchema, castUpdatedAt: NullableString, cast: Type.Array(TvCastPersonSchema),
  hierarchyStatus: HierarchyStatusSchema, seasons: Type.Array(TvSeasonSummarySchema), orphanSpecials: Type.Array(TvEpisodeSchema),
})]);
export type TvSeasonSummary = Static<typeof TvSeasonSummarySchema>;
export type GetTvSeriesParams = Static<typeof GetTvSeriesParamsSchema>;
export type TvSeriesDetail = Static<typeof TvSeriesDetailSchema>;
export type TvCastPerson = Static<typeof TvCastPersonSchema>;
