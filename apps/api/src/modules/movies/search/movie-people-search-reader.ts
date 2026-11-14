import { inject, injectable } from "tsyringe";
import { Client as TypesenseClient } from "typesense";
import { TYPESENSE_CLIENT, TYPESENSE_CONFIG, type TypesenseConfig } from "../../../shared/search/search.tokens";
import { withTimeout } from "../../../shared/search/with-timeout";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";

export const MOVIE_PEOPLE_SEARCH_READER = Symbol("MoviePeopleSearchReader");
export type MoviePeopleSearchQuery = { collection: string; q: string; limit: number };
/** Person UUIDs in index order, or null when the index cannot answer (use SQL). */
export interface IMoviePeopleSearchReader { search(query: MoviePeopleSearchQuery): Promise<{ ids: string[] } | null> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Physical generations written by the worker's people step. */
export function isOwnedMoviePeopleCollection(collection: string): boolean {
  return /^movie_people_en__v1_[a-zA-Z0-9_]+$/.test(collection);
}
export function moviePeopleSearchParameters(query: MoviePeopleSearchQuery) {
  if (!isOwnedMoviePeopleCollection(query.collection)) throw new Error("Invalid movie people search collection");
  return {
    q: query.q, query_by: "name", page: 1, per_page: query.limit,
    include_fields: "id", exclude_fields: "", highlight_fields: "none", enable_overrides: false,
    sort_by: "_text_match:desc,publicCreditCount:desc,nameSort:asc",
    prioritize_token_position: true,
  };
}

@injectable()
export class TypesenseMoviePeopleSearchReader implements IMoviePeopleSearchReader {
  private retryAt = 0;
  constructor(@inject(TYPESENSE_CLIENT) private readonly client: TypesenseClient,
    @inject(TYPESENSE_CONFIG) private readonly config: TypesenseConfig) {}
  async search(query: MoviePeopleSearchQuery) {
    if (!this.config.enabled || Date.now() < this.retryAt) return null;
    if (!/[\p{L}\p{N}]/u.test(query.q)) return { ids: [] };
    try {
      const result = await withTimeout(this.client.collections<{ id: string }>(query.collection).documents()
        .search(moviePeopleSearchParameters(query)), 3000, "typesense.movie_people.search");
      const ids = result.hits?.map((hit) => hit.document.id) ?? [];
      if (result.search_cutoff === true || !Number.isSafeInteger(result.found) || ids.length > query.limit
        || ids.length !== Math.min(query.limit, result.found) || ids.some((id) => !UUID.test(id)) || new Set(ids).size !== ids.length) {
        throw new Error("Invalid movie people search page");
      }
      return { ids };
    } catch (error) {
      if (Date.now() >= this.retryAt) {
        this.retryAt = Date.now() + 30_000;
        reportRuntimeFailure("search_fallback", "Typesense movie people search failed. Using Postgres", error, "warning");
      }
      return null;
    }
  }
}
