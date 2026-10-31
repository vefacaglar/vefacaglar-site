import { Type, Static } from "@sinclair/typebox";
import { GameLogSchema } from "../game-log.schema";
export { GameLogIdParamsSchema } from "../update/update.schema";
export type { GameLogIdParams } from "../update/update.schema";

/** A single log plus the game it belongs to, for the log edit page. */
export const GameLogDetailResponseSchema = Type.Object({
  log: GameLogSchema,
  game: Type.Object({
    slug: Type.String(),
    title: Type.String(),
    coverImageUrl: Type.Union([Type.String(), Type.Null()]),
    platforms: Type.Array(Type.Object({ id: Type.String(), name: Type.String() })),
  }),
});
export type GameLogDetailResponse = Static<typeof GameLogDetailResponseSchema>;
