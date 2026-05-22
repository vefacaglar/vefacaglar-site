import { Type, Static } from "@sinclair/typebox";
import { PublisherResponseSchema } from "../list/list.schema";

export const GetPublisherParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetPublisherParams = Static<typeof GetPublisherParamsSchema>;
export type PublisherResponse = Static<typeof PublisherResponseSchema>;
export { PublisherResponseSchema };
