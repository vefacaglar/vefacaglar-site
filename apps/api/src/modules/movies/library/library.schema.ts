import { Type, type Static } from "@sinclair/typebox";
import { MovieCardSchema } from "../list/list.schema";
import { MovieRatingBodySchema } from "../activity/activity.schema";
export const MovieLibraryParamsSchema = Type.Object({ username: Type.String({ minLength: 1 }) });
export const MovieLibrarySchema = Type.Object({
  user: Type.Object({ username: Type.String(), displayName: Type.String(), isProfilePublic: Type.Boolean() }),
  isOwner: Type.Boolean(),
  summary: Type.Object({ filmCount: Type.Integer(), watchedFilmCount: Type.Integer(), watchCount: Type.Integer(), ratedFilmCount: Type.Integer(), averageRating: Type.Union([Type.Number(), Type.Null()]) }),
  movies: Type.Array(Type.Composite([MovieCardSchema, Type.Object({ rating: MovieRatingBodySchema.properties.rating,
    watchCount: Type.Integer(), lastWatchedOn: Type.Union([Type.String(), Type.Null()]),
    watches: Type.Array(Type.Object({ id: Type.Optional(Type.String()), watchedOn: Type.Union([Type.String(), Type.Null()]) })) })])),
});
export type MovieLibraryParams = Static<typeof MovieLibraryParamsSchema>;
export type MovieLibrary = Static<typeof MovieLibrarySchema>;
