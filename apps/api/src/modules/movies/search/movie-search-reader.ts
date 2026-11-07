import { inject, injectable } from "tsyringe";
import { Client as TypesenseClient } from "typesense";
import { TYPESENSE_CLIENT, TYPESENSE_CONFIG, type TypesenseConfig } from "../../../shared/search/search.tokens";
import { withTimeout } from "../../../shared/search/with-timeout";
import schema from "./movie-search.schema.json";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";

export const MOVIE_SEARCH_READER = Symbol("MovieSearchReader");
export type MovieSearchQuery = { collection: string; q?: string; personQid?: string; page: number; limit: number; fresh: boolean };
export interface IMovieSearchReader { search(query: MovieSearchQuery): Promise<{ ids: string[]; total: number } | null> }
export function isOwnedMovieCollection(collection: string): boolean {
  return /^movies_en__v1_[a-zA-Z0-9_]+$/.test(collection);
}
export function movieSearchParameters(query: MovieSearchQuery) {
  if (!isOwnedMovieCollection(query.collection)) throw new Error("Invalid movie search collection");
  if (query.personQid && !/^Q[1-9]\d*$/.test(query.personQid)) throw new Error("Invalid movie person filter");
  return {
    q: query.q || "*", query_by: schema.fields.filter((field) => field.type === "string" && !field.sort).map((field) => field.name).join(","), page: query.page, per_page: query.limit,
    include_fields: "id", exclude_fields: "", highlight_fields: "none", enable_overrides: false,
    sort_by: query.fresh ? "interestScore:desc,titleSort:asc,tieBreakId:asc" : "titleSort:asc,tieBreakId:asc",
    ...(query.personQid ? { filter_by: `personQids:=${query.personQid}` } : {}),
  };
}

@injectable()
export class TypesenseMovieSearchReader implements IMovieSearchReader {
  private retryAt = 0;
  constructor(@inject(TYPESENSE_CLIENT) private readonly client: TypesenseClient,
    @inject(TYPESENSE_CONFIG) private readonly config: TypesenseConfig) {}
  async search(query: MovieSearchQuery) {
    if (!this.config.enabled || Date.now() < this.retryAt) return null;
    try {
      // Punctuation-only input is not a browse wildcard (same as SQL fallback).
      if (query.q && !/[\p{L}\p{N}]/u.test(query.q)) return { ids: [], total: 0 };
      const result = await withTimeout(this.client.collections<{ id: string }>(query.collection).documents()
        .search(movieSearchParameters(query)), 3000, "typesense.movies.search");
      const ids = result.hits?.map((hit) => hit.document.id) ?? [];
      const total = result.found;
      if (result.search_cutoff === true || !Number.isSafeInteger(total) || total < 0 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || new Set(ids).size !== ids.length
        || ids.length !== Math.min(query.limit, Math.max(0, total - (query.page - 1) * query.limit))) {
        throw new Error("Invalid movie search page");
      }
      return { ids, total };
    } catch (error) {
      if (Date.now() >= this.retryAt) {
        this.retryAt = Date.now() + 30_000;
        reportRuntimeFailure("search_fallback", "Typesense movie search failed. Using Postgres", error, "warning");
      }
      return null;
    }
  }
}
