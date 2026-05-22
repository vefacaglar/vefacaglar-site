import { Type, Static } from "@sinclair/typebox";
import { GameResponseSchema } from "../list/list.schema";

export const GetGameParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetGameParams = Static<typeof GetGameParamsSchema>;
export type GameResponse = Static<typeof GameResponseSchema>;
export { GameResponseSchema };
