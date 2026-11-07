import type { MovieCard } from "../list/list.schema";
export type MovieWatchRow = { id: string; watchedOn: string; comment: string | null; sharedAt: Date | null; createdAt: Date; updatedAt: Date };
export type MovieLibraryRow = { movie: MovieCard; rating: number | null; watches: MovieWatchRow[] };
export interface IMovieActivityRepository {
  findPublicMovieId(slug: string): Promise<string | null>;
  getActivity(userId: string, movieId: string, page: number, limit: number): Promise<{ rating: number | null; watches: MovieWatchRow[]; total: number }>;
  createWatch(userId: string, movieId: string, id: string, watchedOn: string, comment: string | null, isPublic?: boolean): Promise<MovieWatchRow | null>;
  updateWatch(userId: string, movieId: string, id: string, watchedOn: string, comment?: string | null, isPublic?: boolean): Promise<MovieWatchRow | null>;
  deleteWatch(userId: string, movieId: string, id: string): Promise<boolean>;
  setRating(userId: string, movieId: string, rating: number | null): Promise<void>;
  listLibrary(userId: string): Promise<MovieLibraryRow[]>;
  countPublicMovies(): Promise<number>;
}
