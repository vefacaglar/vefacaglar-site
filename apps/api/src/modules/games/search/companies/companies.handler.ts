import type { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { SEARCH_READER } from "../../../../shared/search/search.tokens";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import type { PublicCompanyMatch } from "../../../catalog/games.repository.interface";
import { publicSearchTerm } from "../search-term";
import type { CompanyMatch, SearchCompaniesQuery, SearchCompaniesResponse } from "./companies.schema";

const DEFAULT_LIMIT = 12;

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
    if (!term) return { developers: [], publishers: [] };
    const limit = request.query.limit ?? DEFAULT_LIMIT;
    // Typesense relevance with a Postgres fallback; only companies with at least one game.
    const [developers, publishers] = await Promise.all([
      this.searchReader.searchPublicCompanies("developer", { q: term, limit }),
      this.searchReader.searchPublicCompanies("publisher", { q: term, limit }),
    ]);
    return { developers: developers.map(publicCompanyMatch), publishers: publishers.map(publicCompanyMatch) };
  }
}
