import { Type, type Static } from "@sinclair/typebox";
export const MovieStatsSchema = Type.Object({
  movieCount: Type.Integer({ minimum: 0, description: "Public hydrated films" }),
  catalogCount: Type.Integer({ minimum: 0, description: "All catalog rows, including unhydrated stubs and non-films" }),
  withPosterCount: Type.Integer({ minimum: 0, description: "Public films with a stored, unblocked poster image" }),
  posterBlockedCount: Type.Integer({ minimum: 0, description: "Movies whose poster is hidden by an admin block" }),
});
export type MovieStats = Static<typeof MovieStatsSchema>;
