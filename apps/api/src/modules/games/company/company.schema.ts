import { Type, type Static } from "@sinclair/typebox";
import { GameCardSchema } from "../list/list.schema";

export const GameCompanyParamsSchema = Type.Object({
  slug: Type.String({ minLength: 1, maxLength: 200 }),
});
export type GameCompanyParams = Static<typeof GameCompanyParamsSchema>;

export const GameCompanyQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })),
});
export type GameCompanyQuery = Static<typeof GameCompanyQuerySchema>;

export const GameCompanyResponseSchema = Type.Object({
  company: Type.Object({
    id: Type.String(),
    name: Type.String(),
    slug: Type.String(),
    countryCode: Type.Union([Type.String(), Type.Null()]),
    role: Type.Union([Type.Literal("developer"), Type.Literal("publisher")]),
  }),
  items: Type.Array(GameCardSchema),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
  limit: Type.Integer({ minimum: 1 }),
  totalPages: Type.Integer({ minimum: 0 }),
});
export type GameCompanyResponse = Static<typeof GameCompanyResponseSchema>;
