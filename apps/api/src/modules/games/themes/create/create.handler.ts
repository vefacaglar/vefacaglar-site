import { FastifyRequest } from "fastify";
import { CreateThemeRequest, ThemeResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class CreateThemeHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Body: CreateThemeRequest }>): Promise<ThemeResponse> {
    const { name, slug } = request.body;

    const newTheme = await this.gameService.createTheme({
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
