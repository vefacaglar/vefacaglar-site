import { Type, Static } from "@sinclair/typebox";
import { gameStatusEnum } from "@vefacaglar/db";
import type { GameLogWithPlatform } from "../game-logs.repository.interface";

const NullableString = Type.Union([Type.String(), Type.Null()]);
const NullableDate = Type.Union([Type.String({ format: "date" }), Type.Null()]);

export const GameLogStatusSchema = Type.Union(gameStatusEnum.map((s) => Type.Literal(s)));

export const GameLogSchema = Type.Object({
  id: Type.String(),
  status: GameLogStatusSchema,
  platform: Type.Union([Type.Object({ id: Type.String(), name: Type.String() }), Type.Null()]),
  rating: Type.Union([Type.Number(), Type.Null()]),
  startedAt: NullableString,
  completedAt: NullableString,
  playtimeHours: Type.Union([Type.Number(), Type.Null()]),
  notes: NullableString,
  createdAt: Type.String(),
});
export type GameLog = Static<typeof GameLogSchema>;

/** Body shared by create and update; update applies it as a full replacement. */
export const GameLogBodySchema = Type.Object({
  status: GameLogStatusSchema,
  platformId: Type.Optional(Type.Union([Type.String({ format: "uuid" }), Type.Null()])),
  // Out of 100.
  rating: Type.Optional(Type.Union([Type.Integer({ minimum: 0, maximum: 100 }), Type.Null()])),
  startedAt: Type.Optional(NullableDate),
  completedAt: Type.Optional(NullableDate),
  playtimeHours: Type.Optional(Type.Union([Type.Number({ minimum: 0, maximum: 100000 }), Type.Null()])),
  notes: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
});
export type GameLogBody = Static<typeof GameLogBodySchema>;

export function toGameLog(row: GameLogWithPlatform): GameLog {
  return {
    id: row.id,
    status: row.status,
    platform: row.platformId && row.platformName ? { id: row.platformId, name: row.platformName } : null,
    rating: row.rating,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    playtimeHours: row.playtimeHours === null ? null : Number(row.playtimeHours),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}
