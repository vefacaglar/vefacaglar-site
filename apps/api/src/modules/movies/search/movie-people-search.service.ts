import { inject, injectable } from "tsyringe";
import type { IMoviesRepository } from "../movies.repository.interface";
import { MOVIES_REPOSITORY } from "../movies.tokens";
import type { MoviePersonSummary } from "../people/search/search.schema";
import { MOVIE_PEOPLE_SEARCH_READER, isOwnedMoviePeopleCollection, type IMoviePeopleSearchReader } from "./movie-people-search-reader";
import { MOVIE_PEOPLE_SEARCH_SCHEMA_VERSION, MOVIE_PEOPLE_SEARCH_STATE_REPOSITORY, type IMoviePeopleSearchStateRepository } from "./movie-search.types";

export const MOVIE_PEOPLE_SEARCH_SERVICE = Symbol("MoviePeopleSearchService");
export interface IMoviePeopleSearchService {
  searchPublicPeople(q: string, limit: number): Promise<MoviePersonSummary[]>;
}

/** Meilisearch people index first; SQL prefix search when it is not ready, fails, or returns stale people. */
@injectable()
export class MoviePeopleSearchService implements IMoviePeopleSearchService {
  constructor(@inject(MOVIES_REPOSITORY) private readonly repo: IMoviesRepository,
    @inject(MOVIE_PEOPLE_SEARCH_STATE_REPOSITORY) private readonly stateRepo: IMoviePeopleSearchStateRepository,
    @inject(MOVIE_PEOPLE_SEARCH_READER) private readonly reader: IMoviePeopleSearchReader) {}

  async searchPublicPeople(q: string, limit: number) {
    return (await this.indexed(q, limit)) ?? this.repo.searchPublicPeople(q, limit);
  }

  private async indexed(q: string, limit: number) {
    try {
      const state = await this.stateRepo.state();
      if (!state || state.schemaVersion !== MOVIE_PEOPLE_SEARCH_SCHEMA_VERSION || !state.activeCollection
        || !isOwnedMoviePeopleCollection(state.activeCollection)) return null;
      const selected = await this.reader.search({ collection: state.activeCollection, q, limit });
      if (!selected) return null;
      if (!selected.ids.length) return [];
      const people = await this.repo.hydratePublicPeople(selected.ids);
      // Fail closed: a person who lost every public credit since the snapshot
      // makes the whole answer come from SQL instead of a short list.
      return people.length === selected.ids.length ? people : null;
    } catch {
      // Index metadata/hydration errors must not take people search offline.
      return null;
    }
  }
}
