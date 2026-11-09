import { Type, type Static } from "@sinclair/typebox";
export const ListDashboardMoviesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  q: Type.Optional(Type.String({ maxLength: 140 })),
  blocked: Type.Optional(Type.Boolean({ description: "Only movies whose poster is blocked" })),
});
export type ListDashboardMoviesQuery = Static<typeof ListDashboardMoviesQuerySchema>;
export const DashboardMovieSchema = Type.Object({
  id: Type.String({ format: "uuid" }), slug: Type.String(), title: Type.String(),
  releaseYear: Type.Union([Type.Integer(), Type.Null()]),
  posterImageUrl: Type.Union([Type.String(), Type.Null()], { description: "Stored poster URL, shown to admins even when blocked" }),
  isPublic: Type.Boolean(), posterBlocked: Type.Boolean(), posterBlockedAt: Type.Union([Type.String(), Type.Null()]),
});
export type DashboardMovie = Static<typeof DashboardMovieSchema>;
export const ListDashboardMoviesResponseSchema = Type.Object({ items: Type.Array(DashboardMovieSchema), total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }), limit: Type.Integer({ minimum: 1 }), totalPages: Type.Integer({ minimum: 0 }) });
export type ListDashboardMoviesResponse = Static<typeof ListDashboardMoviesResponseSchema>;
