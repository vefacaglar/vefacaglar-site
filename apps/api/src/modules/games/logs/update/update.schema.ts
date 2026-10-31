import { Type, Static } from "@sinclair/typebox";
export { GameLogBodySchema, GameLogSchema } from "../game-log.schema";
export type { GameLogBody, GameLog } from "../game-log.schema";

export const GameLogIdParamsSchema = Type.Object({ id: Type.String({ format: "uuid" }) });
export type GameLogIdParams = Static<typeof GameLogIdParamsSchema>;
