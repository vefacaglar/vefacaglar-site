import { Type, Static } from "@sinclair/typebox";
import { PublisherResponseSchema } from "../list/list.schema";

export const UpdatePublisherParamsSchema = Type.Object({
  id: Type.String(),
});

export const UpdatePublisherRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
  countryCode: Type.Optional(Type.Union([Type.String({ minLength: 2, maxLength: 2 }), Type.Null()])),
});

export type UpdatePublisherParams = Static<typeof UpdatePublisherParamsSchema>;
export type UpdatePublisherRequest = Static<typeof UpdatePublisherRequestSchema>;
export type PublisherResponse = Static<typeof PublisherResponseSchema>;
export { PublisherResponseSchema };
