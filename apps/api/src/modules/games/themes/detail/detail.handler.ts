import { FastifyRequest } from "fastify";
import { GetThemeParams, ThemeResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class GetThemeHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: GetThemeParams }>): Promise<ThemeResponse> {
    const { id } = request.params;

    const theme = await this.gameService.getThemeById(id);

    return {
      id: theme.id,
      name: theme.name,
      slug: theme.slug,
      createdAt: theme.createdAt.toISOString(),
      updatedAt: theme.updatedAt ? theme.updatedAt.toISOString() : null,
    };
  }
}
