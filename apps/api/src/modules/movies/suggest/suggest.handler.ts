import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import type { IMoviesRepository } from "../movies.repository.interface";
import { MOVIES_REPOSITORY } from "../movies.tokens";
import { movieSearchTokens } from "../movie-search-tokens";
import { MOVIE_CATALOG_SERVICE, type IMovieCatalogService } from "../search/movie-catalog.service";
import { MOVIE_PEOPLE_SEARCH_SERVICE, type IMoviePeopleSearchService } from "../search/movie-people-search.service";
import { orderSuggestionGroups } from "../../../shared/search/suggestion-group-order";
import type { MovieSuggestionGroup, MovieSuggestQuery, MovieSuggestResponse } from "./suggest.schema";

export const MOVIE_SUGGEST_LIMIT = 5;
/** Group order on a tie: a name group before a title group (see `orderSuggestionGroups`). */
const TIE_ORDER: MovieSuggestionGroup[] = ["people", "movies"];

/** Search-box typeahead: a few titles and people (each index first, SQL fallback), best-matching group first. */
@injectable()
export class SuggestMoviesHandler {
  constructor(@inject(MOVIE_CATALOG_SERVICE) private readonly catalog: IMovieCatalogService,
    @inject(MOVIE_PEOPLE_SEARCH_SERVICE) private readonly people: IMoviePeopleSearchService,
    @inject(MOVIES_REPOSITORY) private readonly repo: IMoviesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: MovieSuggestQuery }>): Promise<MovieSuggestResponse> {
    const q = request.query.q?.trim() ?? "";
    if (!movieSearchTokens(q).length) return { movies: [], people: [], order: [...TIE_ORDER] };
    const [catalog, people] = await Promise.all([
      this.catalog.listPublic({ page: 1, limit: MOVIE_SUGGEST_LIMIT, q }),
      this.people.searchPublicPeople(q, MOVIE_SUGGEST_LIMIT),
    ]);
    const items = catalog.items.slice(0, MOVIE_SUGGEST_LIMIT);
    const directors = items.length ? await this.repo.findDirectorNames(items.map((item) => item.slug)) : {};
    const movies = items.map((item) => ({ slug: item.slug, title: item.title, releaseYear: item.releaseYear, director: directors[item.slug] ?? null }));
    const order = orderSuggestionGroups(q, TIE_ORDER.map((key) => ({
      key, texts: key === "people" ? people.map((person) => person.name) : movies.map((movie) => movie.title),
    })));
    return { movies, people, order };
  }
}
