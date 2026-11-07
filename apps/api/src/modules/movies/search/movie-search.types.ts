import type { movieSearchState } from "@vefacaglar/db";
export const MOVIE_SEARCH_STATE_REPOSITORY = Symbol("MovieSearchStateRepository");
export const MOVIE_SEARCH_ID = "movies_en";
export const MOVIE_SEARCH_SCHEMA_VERSION = 2;
export type MovieSearchState = typeof movieSearchState.$inferSelect;
export interface IMovieSearchStateRepository { state(): Promise<MovieSearchState | null> }
