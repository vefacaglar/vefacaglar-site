import { BadRequestError } from "../../../shared/http-errors";
import type { MovieWatchRow } from "./activity.repository.interface";
import type { MovieWatch } from "./activity.schema";
import { validateLogDate } from "../../../shared/log-dates";
export function validateWatchDate(value: string | null | undefined, previous?: string | null, now = new Date()): string | null {
  return validateLogDate(value, previous, now, "err_movie_watch_date");
}
export function latestKnownWatchDate(watches: readonly Pick<MovieWatchRow, "watchedOn">[]): string | null {
  return watches.reduce<string | null>((latest, watch) => watch.watchedOn !== null && (latest === null || watch.watchedOn > latest) ? watch.watchedOn : latest, null);
}
export function normalizeWatchComment(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (Array.from(value).length > 2000) throw new BadRequestError("err_movie_watch_comment");
  return value.trim() || null;
}
export function toMovieWatch(row: MovieWatchRow): MovieWatch {
  return { id: row.id, watchedOn: row.watchedOn, comment: row.comment, isPublic: row.sharedAt != null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
