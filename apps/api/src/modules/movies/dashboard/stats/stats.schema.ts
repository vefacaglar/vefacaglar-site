import { Type, type Static } from "@sinclair/typebox";
export const MovieStatsSchema = Type.Object({ movieCount: Type.Integer({ minimum: 0 }) });
export type MovieStats = Static<typeof MovieStatsSchema>;
