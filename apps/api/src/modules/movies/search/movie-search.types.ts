import type { moviePeopleSearchState, movieSearchState } from "@vefacaglar/db";
export const MOVIE_SEARCH_STATE_REPOSITORY = Symbol("MovieSearchStateRepository");
export const MOVIE_SEARCH_ID = "movies_en";
export const MOVIE_SEARCH_SCHEMA_VERSION = 3;
export type MovieSearchState = typeof movieSearchState.$inferSelect;
export interface IMovieSearchStateRepository { state(): Promise<MovieSearchState | null> }

export const MOVIE_PEOPLE_SEARCH_STATE_REPOSITORY = Symbol("MoviePeopleSearchStateRepository");
export const MOVIE_PEOPLE_SEARCH_ID = "movie_people_en";
export const MOVIE_PEOPLE_SEARCH_SCHEMA_VERSION = 2;
export type MoviePeopleSearchState = typeof moviePeopleSearchState.$inferSelect;
export interface IMoviePeopleSearchStateRepository { state(): Promise<MoviePeopleSearchState | null> }
