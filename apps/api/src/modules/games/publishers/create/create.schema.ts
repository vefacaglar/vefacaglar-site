import { Type, Static } from "@sinclair/typebox";
import { PublisherResponseSchema } from "../list/list.schema";

export const CreatePublisherRequestSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  countryCode: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
});

export type CreatePublisherRequest = Static<typeof CreatePublisherRequestSchema>;
export type PublisherResponse = Static<typeof PublisherResponseSchema>;
export { PublisherResponseSchema };
