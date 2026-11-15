import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { MOVIE_PEOPLE_SEARCH_SERVICE, type IMoviePeopleSearchService } from "../../search/movie-people-search.service";
import { MOVIE_CATALOG_SERVICE, type IMovieCatalogService } from "../../search/movie-catalog.service";
import { orderSuggestionGroups } from "../../../../shared/search/suggestion-group-order";
import { movieSearchTokens } from "../../movie-search-tokens";
import type { SearchMoviePeopleGroup, SearchMoviePeopleQuery, SearchMoviePeopleResponse } from "./search.schema";

const TITLES_SCORE_LIMIT = 5;
/** Group order on a tie, same as the dropdown: people before titles. */
const TIE_ORDER: SearchMoviePeopleGroup[] = ["people", "movies"];

/** People matching a catalog search, for the public results page. */
@injectable()
export class SearchMoviePeopleHandler {
  constructor(@inject(MOVIE_PEOPLE_SEARCH_SERVICE) private readonly people: IMoviePeopleSearchService,
    @inject(MOVIE_CATALOG_SERVICE) private readonly catalog: IMovieCatalogService) {}

  async handle(request: FastifyRequest<{ Querystring: SearchMoviePeopleQuery }>): Promise<SearchMoviePeopleResponse> {
    const q = request.query.q?.trim() ?? "";
    // Blank or punctuation-only input never lists everyone.
    if (!movieSearchTokens(q).length) return { items: [], order: [...TIE_ORDER] };
    const [items, titles] = await Promise.all([this.people.searchPublicPeople(q, request.query.limit ?? 12), this.topTitles(q)]);
    // Without catalog titles to score, the sections keep the tie order instead of failing the endpoint.
    const order = titles
      ? orderSuggestionGroups(q, TIE_ORDER.map((key) => ({ key, texts: key === "people" ? items.slice(0, TITLES_SCORE_LIMIT).map((person) => person.name) : titles })))
      : [...TIE_ORDER];
    return { items, order };
  }

  /** Top catalog titles for the query (the same search the results grid uses), or null when that lookup fails. */
  private async topTitles(q: string): Promise<string[] | null> {
    try {
      const { items } = await this.catalog.listPublic({ page: 1, limit: TITLES_SCORE_LIMIT, q });
      return items.slice(0, TITLES_SCORE_LIMIT).map((movie) => movie.title);
    } catch {
      return null;
    }
  }
}
