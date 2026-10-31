import { Type, Static } from "@sinclair/typebox";
import { GameLogStatusSchema } from "../logs/game-log.schema";

const NullableNumber = Type.Union([Type.Number(), Type.Null()]);

export const LibraryGameSchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  /** Status of the most recent log. */
  status: GameLogStatusSchema,
  /** Rating of the most recent rated log. */
  rating: NullableNumber,
  /** Playtime summed over all of this game's logs. */
  playtimeHours: NullableNumber,
  logCount: Type.Number(),
  lastLoggedAt: Type.String(),
});

export const LibraryResponseSchema = Type.Object({
  summary: Type.Object({
    gameCount: Type.Number(),
    logCount: Type.Number(),
    completedCount: Type.Number(),
    playtimeHours: Type.Number(),
    averageRating: NullableNumber,
  }),
  games: Type.Array(LibraryGameSchema),
});
export type LibraryResponse = Static<typeof LibraryResponseSchema>;
export type LibraryGame = Static<typeof LibraryGameSchema>;
