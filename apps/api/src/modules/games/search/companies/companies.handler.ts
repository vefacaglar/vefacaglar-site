import type { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../../../catalog/catalog.tokens";
import type { IGamesRepository, PublicCompanyMatch } from "../../../catalog/games.repository.interface";
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
  constructor(@inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: SearchCompaniesQuery }>): Promise<SearchCompaniesResponse> {
    const term = publicSearchTerm(request.query.q);
    if (!term) return { developers: [], publishers: [] };
    const limit = request.query.limit ?? DEFAULT_LIMIT;
    const [developers, publishers] = await Promise.all([
      this.gamesRepo.searchPublicCompanies("developer", term, limit),
      this.gamesRepo.searchPublicCompanies("publisher", term, limit),
    ]);
    return { developers: developers.map(publicCompanyMatch), publishers: publishers.map(publicCompanyMatch) };
  }
}
