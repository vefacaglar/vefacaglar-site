import { Type, Static } from "@sinclair/typebox";
export { GameLogBodySchema, GameLogSchema } from "../game-log.schema";
export type { GameLogBody, GameLog } from "../game-log.schema";

export const CreateGameLogParamsSchema = Type.Object({ slug: Type.String() });
export type CreateGameLogParams = Static<typeof CreateGameLogParamsSchema>;
