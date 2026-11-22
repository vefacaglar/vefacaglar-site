import { Type, type Static } from "@sinclair/typebox";
import { NullableNumber, NullableString } from "../list/list.schema";
import { HierarchyStatusSchema, TvSeasonSummarySchema } from "../detail/detail.schema";
export const GetTvSeasonParamsSchema = Type.Object({ id: Type.Integer({ minimum: 1, maximum: 2147483647 }), seasonId: Type.Integer({ minimum: 1, maximum: 2147483647 }) });
import { TvEpisodeSchema } from "../tv-episode.schema";
export const TvSeasonDetailSchema = Type.Object({
  series: Type.Object({ id: Type.Integer(), title: Type.String() }), season: TvSeasonSummarySchema,
  episodes: Type.Array(TvEpisodeSchema), hierarchyStatus: HierarchyStatusSchema, sourceUrl: Type.String(),
});
export type GetTvSeasonParams = Static<typeof GetTvSeasonParamsSchema>;
export type { TvEpisode } from "../tv-episode.schema";
export type TvSeasonDetail = Static<typeof TvSeasonDetailSchema>;
