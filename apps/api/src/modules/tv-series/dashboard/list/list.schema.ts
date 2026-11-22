import { Type, type Static } from "@sinclair/typebox";
const nullableInteger = Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]);
const nullableString = Type.Union([Type.String(), Type.Null()]);
export const ListDashboardTvQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  q: Type.Optional(Type.String({ maxLength: 140 })),
  hydration: Type.Optional(Type.Union([Type.Literal("all"), Type.Literal("pending"), Type.Literal("complete")])),
});
export type ListDashboardTvQuery = Static<typeof ListDashboardTvQuerySchema>;
export const ListDashboardTvResponseSchema = Type.Object({
  items: Type.Array(Type.Object({ id: Type.Integer(), title: Type.String(), sourceUrl: Type.String(), hierarchyComplete: Type.Boolean(),
    seasonCount: nullableInteger, episodeCount: nullableInteger, specialCount: nullableInteger,
    hierarchyUpdatedAt: nullableString, fetchedAt: Type.String() })),
  total: Type.Integer({ minimum: 0 }), page: Type.Integer({ minimum: 1 }), limit: Type.Integer({ minimum: 1 }), totalPages: Type.Integer({ minimum: 0 }),
});
export type ListDashboardTvResponse = Static<typeof ListDashboardTvResponseSchema>;
