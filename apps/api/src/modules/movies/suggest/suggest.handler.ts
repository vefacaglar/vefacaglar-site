import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import type { IMoviesRepository } from "../movies.repository.interface";
import { MOVIES_REPOSITORY } from "../movies.tokens";
import { movieSearchTokens } from "../movie-search-tokens";
import { MOVIE_CATALOG_SERVICE, type IMovieCatalogService } from "../search/movie-catalog.service";
import { MOVIE_PEOPLE_SEARCH_SERVICE, type IMoviePeopleSearchService } from "../search/movie-people-search.service";
import type { MovieSuggestQuery, MovieSuggestResponse } from "./suggest.schema";

export const MOVIE_SUGGEST_LIMIT = 5;

/** Search-box typeahead: a few titles and people (each index first, SQL fallback). */
@injectable()
export class SuggestMoviesHandler {
  constructor(@inject(MOVIE_CATALOG_SERVICE) private readonly catalog: IMovieCatalogService,
    @inject(MOVIE_PEOPLE_SEARCH_SERVICE) private readonly people: IMoviePeopleSearchService,
    @inject(MOVIES_REPOSITORY) private readonly repo: IMoviesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: MovieSuggestQuery }>): Promise<MovieSuggestResponse> {
    const q = request.query.q?.trim() ?? "";
    if (!movieSearchTokens(q).length) return { movies: [], people: [] };
    const [catalog, people] = await Promise.all([
      this.catalog.listPublic({ page: 1, limit: MOVIE_SUGGEST_LIMIT, q }),
      this.people.searchPublicPeople(q, MOVIE_SUGGEST_LIMIT),
    ]);
    const items = catalog.items.slice(0, MOVIE_SUGGEST_LIMIT);
    const directors = items.length ? await this.repo.findDirectorNames(items.map((item) => item.slug)) : {};
    return {
      movies: items.map((item) => ({ slug: item.slug, title: item.title, releaseYear: item.releaseYear, director: directors[item.slug] ?? null })),
      people,
    };
  }
}
