import type { MovieRanking } from "./popularity/popularity.types";
import type { MovieCard } from "./list/list.schema";
import type { MovieDetail } from "./detail/detail.schema";
import type { EntityLabels, NormalizedMovie } from "./import/movie-source.types";
import type { MoviePersonFilm } from "./people/detail/detail.schema";
export type MoviePersonResult = {
  person: { wikidataId: string; name: string | null };
  items: MoviePersonFilm[];
  total: number;
  ranking: MovieRanking;
};
export type MovieCandidate = { id: string; wikidataId: string; sourceRevision: number | null };
export type MovieSourceState = { discoveryComplete: boolean; discoveryCycle: number; discoveryStrategy: string | null;
  nextDiscoveryAt: Date | null; cooldownUntil: Date | null; artworkCooldownUntil: Date | null; wikipediaArtworkCooldownUntil: Date | null; failureCount: number; refreshCursor: string | null; lastSuccessAt: Date | null };
export interface IMoviesRepository {
  ensureSourceAndSeeds(): Promise<{ inserted: number; state: MovieSourceState }>;
  sourceState(): Promise<MovieSourceState>;
  saveSourceState(patch: Partial<MovieSourceState>): Promise<void>;
  insertDiscovered(qids: string[]): Promise<number>;
  hydrationCandidates(limit: number, now: Date): Promise<MovieCandidate[]>;
  refreshCandidates(afterId: string | null, limit: number, before: Date, now: Date): Promise<MovieCandidate[]>;
  recognitionCandidates(limit: number, now: Date): Promise<MovieCandidate[]>;
  persistMovie(movie: NormalizedMovie, now: Date): Promise<"updated" | "unchanged" | "imdb_conflict">;
  markEntityFailure(qid: string, code: string, now: Date): Promise<void>;
  findLabels(qids: string[]): Promise<Record<string, { name: string | null; checkedAt: Date }>>;
  labelRefreshCandidates(limit: number, before: Date): Promise<string[]>;
  writeLabels(labels: EntityLabels, now: Date): Promise<void>;
  hasPendingWork(now: Date): Promise<boolean>;
  listPublic(filter: { page: number; limit: number; q?: string }): Promise<{ items: MovieCard[]; total: number; ranking: MovieRanking }>;
  findPublicPersonHeader(wikidataId: string): Promise<{ id: string; wikidataId: string; name: string | null } | null>;
  hydratePublicIds(ids: string[], personId?: string): Promise<(MovieCard | MoviePersonFilm)[]>;
  findPublicBySlug(slug: string): Promise<MovieDetail | null>;
  findPublicPerson(wikidataId: string, filter: { page: number; limit: number }): Promise<MoviePersonResult | null>;
}
