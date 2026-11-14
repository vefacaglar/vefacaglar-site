import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { MOVIE_PEOPLE_SEARCH_SERVICE, type IMoviePeopleSearchService } from "../../search/movie-people-search.service";
import { movieSearchTokens } from "../../movie-search-tokens";
import type { SearchMoviePeopleQuery, SearchMoviePeopleResponse } from "./search.schema";

/** People matching a catalog search, for the public results page. */
@injectable()
export class SearchMoviePeopleHandler {
  constructor(@inject(MOVIE_PEOPLE_SEARCH_SERVICE) private readonly people: IMoviePeopleSearchService) {}

  async handle(request: FastifyRequest<{ Querystring: SearchMoviePeopleQuery }>): Promise<SearchMoviePeopleResponse> {
    const q = request.query.q?.trim() ?? "";
    // Blank or punctuation-only input never lists everyone.
    if (!movieSearchTokens(q).length) return { items: [] };
    return { items: await this.people.searchPublicPeople(q, request.query.limit ?? 12) };
  }
}
