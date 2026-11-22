import { inject, injectable } from "tsyringe";
import type { IMoviesRepository, MoviePersonResult } from "../movies.repository.interface";
import { MOVIES_REPOSITORY } from "../movies.tokens";
import { audienceRanking } from "../popularity/audience-ranking";
import { MOVIE_SEARCH_READER, isOwnedMovieCollection, type IMovieSearchReader } from "./movie-search-reader";
import { MOVIE_SEARCH_SCHEMA_VERSION, MOVIE_SEARCH_STATE_REPOSITORY, type IMovieSearchStateRepository, type MovieSearchState } from "./movie-search.types";

export const MOVIE_CATALOG_SERVICE = Symbol("MovieCatalogService");
export interface IMovieCatalogService {
  listPublic: IMoviesRepository["listPublic"];
  findPublicPerson: IMoviesRepository["findPublicPerson"];
}
function ready(state: MovieSearchState | null): state is MovieSearchState & { activeCollection: string } {
  return !!state && state.schemaVersion === MOVIE_SEARCH_SCHEMA_VERSION && state.bootstrapPhase === "ready"
    && state.rankingReady && !!state.activeCollection && isOwnedMovieCollection(state.activeCollection);
}
function samePublication(before: MovieSearchState, after: MovieSearchState | null): boolean {
  return ready(after) && before.activeCollection === after.activeCollection
    && before.rankingGeneration === after.rankingGeneration && before.publishedSourceDate === after.publishedSourceDate && before.hasPublicInterest === after.hasPublicInterest && JSON.stringify(before.sourceDetails) === JSON.stringify(after.sourceDetails);
}

@injectable()
export class MovieCatalogService implements IMovieCatalogService {
  constructor(@inject(MOVIES_REPOSITORY) private readonly repo: IMoviesRepository,
    @inject(MOVIE_SEARCH_STATE_REPOSITORY) private readonly stateRepo: IMovieSearchStateRepository,
    @inject(MOVIE_SEARCH_READER) private readonly reader: IMovieSearchReader) {}
  async listPublic(filter: { page: number; limit: number; q?: string }) {
    const indexed = await this.indexedPage(filter);
    return indexed ?? this.repo.listPublic(filter);
  }
  findPublicPerson(wikidataId: string): Promise<MoviePersonResult | null> {
    // A person's whole filmography is year-ordered and unpaged, so it never uses the ranked index.
    return this.repo.findPublicPerson(wikidataId);
  }
  private async indexedPage(filter: { page: number; limit: number; q?: string }) {
    // Readiness belongs to the database publication, never a cached/nonzero count.
    try {
      const before = await this.stateRepo.state();
      if (!ready(before)) return null;
      const ranking = audienceRanking(before.sourceDetails, before.hasPublicInterest);
      const selected = await this.reader.search({ ...filter, collection: before.activeCollection,
        fresh: ranking.isFresh });
      if (!selected) return null;
      const hydrated = await this.repo.hydrateCatalogPage(selected.ids);
      const items = hydrated.items.map((item) => ({
        ...item,
        posterImageUrl: null,
        posterAttribution: null,
      }));
      const after = hydrated.state;
      if (!samePublication(before, after) || ranking.isFresh !== audienceRanking(after?.sourceDetails ?? null, after?.hasPublicInterest ?? false).isFresh || items.length !== selected.ids.length) return null;
      return { items, total: selected.total, ranking };
    } catch {
      // Index metadata/search errors must not take the canonical catalog offline.
      // Search diagnostics are rate-limited by the dedicated reader.
      return null;
    }
  }
}
