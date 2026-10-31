import { Type, Static } from "@sinclair/typebox";
import { GameLogSchema } from "../game-log.schema";

export const ListGameLogsParamsSchema = Type.Object({ slug: Type.String() });
export type ListGameLogsParams = Static<typeof ListGameLogsParamsSchema>;

export const ListGameLogsResponseSchema = Type.Object({ items: Type.Array(GameLogSchema) });
export type ListGameLogsResponse = Static<typeof ListGameLogsResponseSchema>;
