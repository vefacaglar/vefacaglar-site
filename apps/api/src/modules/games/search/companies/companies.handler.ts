import type { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { SEARCH_READER } from "../../../../shared/search/search.tokens";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import type { PublicCompanyMatch } from "../../../catalog/games.repository.interface";
import { publicSearchTerm } from "../search-term";
import { orderSuggestionGroups } from "../../../../shared/search/suggestion-group-order";
import type { CompanyMatch, SearchCompaniesGroup, SearchCompaniesQuery, SearchCompaniesResponse } from "./companies.schema";

const DEFAULT_LIMIT = 12;
/** Titles scored for the games group, as many as the search-box dropdown scores. */
const GAMES_SCORE_LIMIT = 5;
/** Group order on a tie, same as the dropdown: company groups before the games grid. */
const TIE_ORDER: SearchCompaniesGroup[] = ["developers", "publishers", "games"];

/** Public projection of a company match: no ids or administrative fields. */
export function publicCompanyMatch(company: PublicCompanyMatch): CompanyMatch {
  return { name: company.name, slug: company.slug, gameCount: company.gameCount };
}

/** Developers and publishers shown above the game grid of a public games search. */
@injectable()
export class SearchGameCompaniesHandler {
  constructor(@inject(SEARCH_READER) private readonly searchReader: ISearchReader) {}

  async handle(request: FastifyRequest<{ Querystring: SearchCompaniesQuery }>): Promise<SearchCompaniesResponse> {
    const term = publicSearchTerm(request.query.q);
    if (!term) return { developers: [], publishers: [], order: [...TIE_ORDER] };
    const limit = request.query.limit ?? DEFAULT_LIMIT;
    // Meilisearch relevance with a Postgres fallback; only companies with at least one game.
    const [developers, publishers, titles] = await Promise.all([
      this.searchReader.searchPublicCompanies("developer", { q: term, limit }),
      this.searchReader.searchPublicCompanies("publisher", { q: term, limit }),
      this.topGameTitles(term),
    ]);
    const groups = { developers: developers.map(publicCompanyMatch), publishers: publishers.map(publicCompanyMatch) };
    // Without game titles to score, the sections keep the tie order instead of failing the endpoint.
    const order = titles
      ? orderSuggestionGroups(term, TIE_ORDER.map((key) => ({
          key, texts: key === "games" ? titles : groups[key].map((company) => company.name),
        })))
      : [...TIE_ORDER];
    return { ...groups, order };
  }

  /** Top game titles for the query (the same search the grid uses), or null when that lookup fails. */
  private async topGameTitles(term: string): Promise<string[] | null> {
    try {
      const { items } = await this.searchReader.searchPublicGames({ q: term, page: 1, limit: GAMES_SCORE_LIMIT });
      return items.map((game) => game.title);
    } catch {
      return null;
    }
  }
}
