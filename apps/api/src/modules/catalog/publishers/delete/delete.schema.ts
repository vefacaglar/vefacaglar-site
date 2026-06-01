import { Type, Static } from "@sinclair/typebox";

export const DeletePublisherParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeletePublisherParams = Static<typeof DeletePublisherParamsSchema>;

export const DeletePublisherResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeletePublisherResponse = Static<typeof DeletePublisherResponseSchema>;
