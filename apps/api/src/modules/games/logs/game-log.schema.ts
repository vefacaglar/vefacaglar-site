import { Type, Static } from "@sinclair/typebox";
import { gameStatusEnum } from "@vefacaglar/db";
import type { GameLogWithPlatform } from "../game-logs.repository.interface";

const NullableString = Type.Union([Type.Null(), Type.String()]);
const NullableDate = Type.Union([Type.Null(), Type.String({ format: "date" })]);

export const GameLogStatusSchema = Type.Union(gameStatusEnum.map((s) => Type.Literal(s)));

export const GameLogSchema = Type.Object({
  id: Type.String(),
  status: GameLogStatusSchema,
  platform: Type.Union([Type.Null(), Type.Object({ id: Type.String(), name: Type.String() })]),
  rating: Type.Union([Type.Null(), Type.Number()]),
  startedAt: NullableString,
  completedAt: NullableString,
  playtimeHours: Type.Union([Type.Null(), Type.Number()]),
  notes: NullableString,
  createdAt: Type.String(),
});
export type GameLog = Static<typeof GameLogSchema>;

/** Body shared by create and update; update applies it as a full replacement. */
export const GameLogBodySchema = Type.Object({
  status: GameLogStatusSchema,
  platformId: Type.Optional(Type.Union([Type.Null(), Type.String({ format: "uuid" })])),
  // Out of 100.
  rating: Type.Optional(Type.Union([Type.Null(), Type.Integer({ minimum: 0, maximum: 100 })])),
  startedAt: Type.Optional(NullableDate),
  completedAt: Type.Optional(NullableDate),
  playtimeHours: Type.Optional(Type.Union([Type.Null(), Type.Number({ minimum: 0, maximum: 100000 })])),
  notes: Type.Optional(Type.Union([Type.Null(), Type.String({ maxLength: 2000 })])),
});
export type GameLogBody = Static<typeof GameLogBodySchema>;

export function toGameLog(row: GameLogWithPlatform): GameLog {
  const playtime = row.playtimeHours === null ? null : Number(row.playtimeHours);
  return {
    id: row.id,
    status: row.status,
    platform: row.platformId && row.platformName ? { id: row.platformId, name: row.platformName } : null,
    rating: row.rating && row.rating > 0 ? row.rating : null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    playtimeHours: playtime && playtime > 0 ? playtime : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}
