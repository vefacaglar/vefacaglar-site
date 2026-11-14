// Client-safe movie search helpers. Keep this module free of httpClient/server imports.
import type { MoviePersonRole, MoviePersonSummary, MovieSuggestion, MovieSuggestions } from "./movies";

export const MOVIE_SUGGEST_MIN_LENGTH = 2;
export const MOVIE_SEARCH_MAX_LENGTH = 140;
export const MOVIE_SUGGEST_ENDPOINT = "/api/movies/suggest";

/** Trimmed, length-capped typeahead term, or null when it is too short or has no letter/digit. */
export function movieSuggestTerm(value: string | null | undefined): string | null {
  const term = (value ?? "").trim().slice(0, MOVIE_SEARCH_MAX_LENGTH).trim();
  return term.length >= MOVIE_SUGGEST_MIN_LENGTH && /[\p{L}\p{N}]/u.test(term) ? term : null;
}

export function moviePersonPath(wikidataId: string) {
  return `/explore/movies/people/${encodeURIComponent(wikidataId)}`;
}

export type MovieSearchOption =
  | { kind: "movie"; key: string; href: string; label: string; detail: string }
  | { kind: "person"; key: string; href: string; label: string; detail: string };

const withYear = (title: string, year: number | null) => (year === null ? title : `${title} (${year})`);

/** One text line under a person's name, e.g. "Director · Inception (2010)". */
export function moviePersonKnownFor(person: MoviePersonSummary, roleLabels: Record<MoviePersonRole, string>) {
  return [roleLabels[person.role], person.knownFor && withYear(person.knownFor.title, person.knownFor.releaseYear)]
    .filter(Boolean).join(" · ");
}

export function movieSuggestionDetail(movie: MovieSuggestion) {
  return [movie.releaseYear === null ? null : String(movie.releaseYear), movie.director].filter(Boolean).join(" · ");
}

/** Flat option order for keyboard navigation: titles first, then people. */
export function movieSearchOptions(data: MovieSuggestions, roleLabels: Record<MoviePersonRole, string>): MovieSearchOption[] {
  return [
    ...data.movies.map((movie) => ({ kind: "movie" as const, key: `m:${movie.slug}`, href: `/explore/movies/${movie.slug}`,
      label: movie.title, detail: movieSuggestionDetail(movie) })),
    ...data.people.map((person) => ({ kind: "person" as const, key: `p:${person.wikidataId}`, href: moviePersonPath(person.wikidataId),
      label: person.name, detail: moviePersonKnownFor(person, roleLabels) })),
  ];
}

/** Next highlighted option for ArrowDown (+1) / ArrowUp (-1); -1 means none, and both ends wrap through it. */
export function nextMovieOptionIndex(current: number, count: number, step: 1 | -1) {
  if (count <= 0) return -1;
  if (current < 0) return step === 1 ? 0 : count - 1;
  const next = current + step;
  return next < 0 || next >= count ? -1 : next;
}
