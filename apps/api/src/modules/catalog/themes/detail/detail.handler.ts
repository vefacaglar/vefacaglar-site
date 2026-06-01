import { FastifyRequest } from "fastify";
import { GetThemeParams, ThemeResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class GetThemeHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: GetThemeParams }>): Promise<ThemeResponse> {
    const { id } = request.params;

    const theme = await this.catalogService.getThemeById(id);

    return {
      id: theme.id,
      name: theme.name,
      slug: theme.slug,
      createdAt: theme.createdAt.toISOString(),
      updatedAt: theme.updatedAt ? theme.updatedAt.toISOString() : null,
    };
  }
}
