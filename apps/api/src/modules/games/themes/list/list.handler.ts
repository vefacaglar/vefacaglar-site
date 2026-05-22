import { FastifyRequest } from "fastify";
import { ListThemesQuery, ListThemesResponse } from "./list.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class ListThemesHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Querystring: ListThemesQuery }>): Promise<ListThemesResponse> {
    const { page, limit } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 10;

    const { items: rows, total } = await this.gameService.listThemes({
      page: pageNum,
      limit: limitNum,
    });

    const totalPages = Math.ceil(total / limitNum);

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    }));

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };
  }
}
