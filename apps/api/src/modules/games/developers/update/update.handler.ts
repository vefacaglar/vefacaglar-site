import { FastifyRequest } from "fastify";
import { UpdateDeveloperParams, UpdateDeveloperRequest, DeveloperResponse } from "./update.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class UpdateDeveloperHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: UpdateDeveloperParams; Body: UpdateDeveloperRequest }>): Promise<DeveloperResponse> {
    const { id } = request.params;
    const { name, slug, countryCode } = request.body;

    const updatedDev = await this.gameService.updateDeveloper(id, {
      name,
      slug,
      countryCode,
    });

    return {
      id: updatedDev.id,
      name: updatedDev.name,
      slug: updatedDev.slug,
      countryCode: updatedDev.countryCode,
      createdAt: updatedDev.createdAt.toISOString(),
      updatedAt: updatedDev.updatedAt ? updatedDev.updatedAt.toISOString() : null,
    };
  }
}
