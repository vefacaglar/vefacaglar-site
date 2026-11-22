import { Type, type Static } from "@sinclair/typebox";
export const TvDashboardStatsSchema = Type.Object({
  total: Type.Integer({ minimum: 0 }), complete: Type.Integer({ minimum: 0 }), pending: Type.Integer({ minimum: 0 }),
  seasons: Type.Integer({ minimum: 0 }), episodes: Type.Integer({ minimum: 0 }), specials: Type.Integer({ minimum: 0 }),
});
export type TvDashboardStatsResponse = Static<typeof TvDashboardStatsSchema>;
