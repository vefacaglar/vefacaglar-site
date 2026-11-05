import { Type, type Static } from "@sinclair/typebox";
const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Number(), Type.Null()]);
export const MovieCardSchema = Type.Object({ slug: Type.String(), title: Type.String(), releaseDate: nullableString,
  releaseYear: nullableNumber, runtimeMinutes: nullableNumber, posterImageUrl: nullableString });
export const ListMoviesQuerySchema = Type.Object({ page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })), q: Type.Optional(Type.String({ maxLength: 140 })) });
export const ListMoviesResponseSchema = Type.Object({ items: Type.Array(MovieCardSchema), total: Type.Number(), page: Type.Number(), limit: Type.Number(), totalPages: Type.Number() });
export type MovieCard = Static<typeof MovieCardSchema>;
export type ListMoviesQuery = Static<typeof ListMoviesQuerySchema>;
export type ListMoviesResponse = Static<typeof ListMoviesResponseSchema>;
