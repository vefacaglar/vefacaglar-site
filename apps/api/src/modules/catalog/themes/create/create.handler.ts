import { FastifyRequest } from "fastify";
import { CreateThemeRequest, ThemeResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class CreateThemeHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Body: CreateThemeRequest }>): Promise<ThemeResponse> {
    const { name, slug } = request.body;

    const newTheme = await this.catalogService.createTheme({
      name,
      slug,
    });

    return {
      id: newTheme.id,
      name: newTheme.name,
      slug: newTheme.slug,
      createdAt: newTheme.createdAt.toISOString(),
      updatedAt: newTheme.updatedAt ? newTheme.updatedAt.toISOString() : null,
    };
  }
}
