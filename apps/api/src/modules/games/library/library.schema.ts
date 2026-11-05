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
  /** createdAt of the most recent log (ISO timestamp). */
  lastLoggedAt: Type.String(),
  /** Latest completion date across this game's logs ("YYYY-MM-DD"), or null if never completed. */
  completedAt: Type.Union([Type.String({ format: "date" }), Type.Null()]),
  /** Latest of the logs' createdAt/updatedAt and their playtime entries' recordedAt (ISO timestamp). */
  lastActivityAt: Type.String({ format: "date-time" }),
  /** Platform of the most recent log that has one, or null if no log names a platform. */
  platformName: Type.Union([Type.String(), Type.Null()]),
  /** Catalog critic score (0-100), or null when unknown or based on too few reviews. */
  criticScore: NullableNumber,
  /** createdAt of the earliest log (ISO timestamp): when the game entered the library. */
  addedAt: Type.String({ format: "date-time" }),
  /** Id of the most recent log; null on public views not seen by the owner. */
  latestLogId: Type.Union([Type.String(), Type.Null()]),
});

export const LibraryPlatformCountSchema = Type.Object({
  name: Type.String(),
  /** Number of distinct games whose `platformName` is this platform. */
  count: Type.Number(),
});

export const LibraryActivityItemSchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  status: GameLogStatusSchema,
  playtimeHours: NullableNumber,
  activityAt: Type.String({ format: "date-time" }),
  /** Log id; null on public views not seen by the owner. */
  logId: Type.Union([Type.String(), Type.Null()]),
});

export const LibraryResponseSchema = Type.Object({
  summary: Type.Object({
    gameCount: Type.Number(),
    logCount: Type.Number(),
    completedCount: Type.Number(),
    playtimeHours: Type.Number(),
    averageRating: NullableNumber,
    /** Games per platform (games without a platform excluded), by count desc then name asc. */
    platforms: Type.Array(LibraryPlatformCountSchema),
  }),
  games: Type.Array(LibraryGameSchema),
  recentActivity: Type.Array(LibraryActivityItemSchema),
});
export type LibraryResponse = Static<typeof LibraryResponseSchema>;
export type LibraryGame = Static<typeof LibraryGameSchema>;
export type LibraryActivityItem = Static<typeof LibraryActivityItemSchema>;
