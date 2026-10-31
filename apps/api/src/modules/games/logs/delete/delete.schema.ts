import { Type, Static } from "@sinclair/typebox";
export { GameLogIdParamsSchema } from "../update/update.schema";
export type { GameLogIdParams } from "../update/update.schema";

export const DeleteGameLogResponseSchema = Type.Object({ success: Type.Boolean() });
export type DeleteGameLogResponse = Static<typeof DeleteGameLogResponseSchema>;
