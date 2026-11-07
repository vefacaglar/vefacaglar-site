import type { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../../../catalog/catalog.tokens";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { publicGameCard } from "../../public-game-card";
import type { DeveloperParams, DeveloperQuery, DeveloperResponse } from "./detail.schema";

@injectable()
export class GetDeveloperGamesHandler {
  constructor(@inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository) {}

  async handle(request: FastifyRequest<{ Params: DeveloperParams; Querystring: DeveloperQuery }>): Promise<DeveloperResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? 21;
    const result = await this.gamesRepo.findPublicCompanyPage("developer", request.params.slug, { page, limit });
    if (!result) throw new NotFoundError("err_page_not_found");
    return {
      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
        countryCode: result.company.countryCode,
        role: result.company.role,
      },
      items: result.items.map(publicGameCard),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}
