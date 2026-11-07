import { Type, type Static } from "@sinclair/typebox";
import { GameLogStatusSchema } from "../logs/game-log.schema";

const NullableString = Type.Union([Type.String(), Type.Null()]);
export const GameCommunityParamsSchema = Type.Object({ slug: Type.String({ minLength: 1, maxLength: 250 }) });
export const GameCommunityQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 1_000_000 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
});
export const GameCommunityEntrySchema = Type.Object({
  id: Type.String(),
  author: Type.Object({ username: Type.String(), displayName: Type.String() }),
  sharedAt: Type.String(),
  text: NullableString,
  rating: Type.Union([Type.Number({ minimum: 1, maximum: 100 }), Type.Null()]),
  status: GameLogStatusSchema,
  startedAt: NullableString,
  completedAt: NullableString,
});
export const GameCommunitySchema = Type.Object({
  rating: Type.Object({
    average: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
    count: Type.Integer({ minimum: 0 }),
    scale: Type.Literal(100),
  }),
  entries: Type.Array(GameCommunityEntrySchema),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});
export type GameCommunityParams = Static<typeof GameCommunityParamsSchema>;
export type GameCommunityQuery = Static<typeof GameCommunityQuerySchema>;
export type GameCommunityEntry = Static<typeof GameCommunityEntrySchema>;
export type GameCommunity = Static<typeof GameCommunitySchema>;
