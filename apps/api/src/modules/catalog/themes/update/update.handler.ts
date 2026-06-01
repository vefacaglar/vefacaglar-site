import { FastifyRequest } from "fastify";
import { UpdateThemeParams, UpdateThemeRequest, ThemeResponse } from "./update.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class UpdateThemeHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: UpdateThemeParams; Body: UpdateThemeRequest }>): Promise<ThemeResponse> {
    const { id } = request.params;
    const { name, slug } = request.body;

    const updatedTheme = await this.catalogService.updateTheme(id, {
      name,
      slug,
    });

    return {
      id: updatedTheme.id,
      name: updatedTheme.name,
      slug: updatedTheme.slug,
      createdAt: updatedTheme.createdAt.toISOString(),
      updatedAt: updatedTheme.updatedAt ? updatedTheme.updatedAt.toISOString() : null,
    };
  }
}
