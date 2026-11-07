import { BadRequestError } from "../../../shared/http-errors";
import type { MovieWatchRow } from "./activity.repository.interface";
import type { MovieWatch } from "./activity.schema";
export function validateWatchDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestError("err_movie_watch_date");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new BadRequestError("err_movie_watch_date");
  return value;
}
export function normalizeWatchComment(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (Array.from(value).length > 2000) throw new BadRequestError("err_movie_watch_comment");
  return value.trim() || null;
}
export function toMovieWatch(row: MovieWatchRow): MovieWatch {
  return { id: row.id, watchedOn: row.watchedOn, comment: row.comment, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
