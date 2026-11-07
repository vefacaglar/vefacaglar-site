import type { MovieCommunityEntry } from "./community.schema";
export type MovieCommunityEntryRow = Omit<MovieCommunityEntry, "sharedAt"> & { sharedAt: Date };
export interface IMovieCommunityRepository {
  findPublicMovieId(slug: string): Promise<string | null>;
  getCommunity(movieId: string, page: number, limit: number): Promise<{
    rating: { average: number | null; count: number };
    entries: MovieCommunityEntryRow[];
    total: number;
  }>;
}
