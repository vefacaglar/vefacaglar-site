import { inject, injectable } from "tsyringe";
import type { IMoviesRepository, MoviePersonResult } from "../movies.repository.interface";
import { MOVIES_REPOSITORY } from "../movies.tokens";
import { movieRanking } from "../popularity/wikipedia-interest";
import type { MoviePersonFilm } from "../people/detail/detail.schema";
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
    && before.rankingGeneration === after.rankingGeneration && before.publishedSourceDate === after.publishedSourceDate;
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
  async findPublicPerson(wikidataId: string, filter: { page: number; limit: number }): Promise<MoviePersonResult | null> {
    const person = await this.repo.findPublicPersonHeader(wikidataId);
    if (!person) return null;
    const indexed = await this.indexedPage(filter, person);
    if (!indexed) return this.repo.findPublicPerson(wikidataId, filter);
    return { ...indexed, person: { wikidataId: person.wikidataId, name: person.name }, items: indexed.items as MoviePersonFilm[] };
  }
  private async indexedPage(filter: { page: number; limit: number; q?: string }, person?: { id: string; wikidataId: string }) {
    // Readiness belongs to the database publication, never a cached/nonzero count.
    try {
      const before = await this.stateRepo.state();
      if (!ready(before)) return null;
      const ranking = movieRanking(before.publishedSourceDate);
      const selected = await this.reader.search({ ...filter, collection: before.activeCollection,
        fresh: ranking.isFresh, personQid: person?.wikidataId });
      if (!selected) return null;
      const items = (await this.repo.hydratePublicIds(selected.ids, person?.id)).map((item) => ({
        ...item,
        posterImageUrl: null,
        posterAttribution: null,
      }));
      const after = await this.stateRepo.state();
      if (!samePublication(before, after) || ranking.isFresh !== movieRanking(after?.publishedSourceDate ?? null).isFresh || items.length !== selected.ids.length) return null;
      return { items, total: selected.total, ranking };
    } catch {
      // Index metadata/search errors must not take the canonical catalog offline.
      // Typesense diagnostics are rate-limited by the dedicated reader.
      return null;
    }
  }
}
