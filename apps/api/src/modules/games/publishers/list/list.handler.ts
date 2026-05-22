import { FastifyRequest } from "fastify";
import { ListPublishersQuery, ListPublishersResponse } from "./list.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class ListPublishersHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Querystring: ListPublishersQuery }>): Promise<ListPublishersResponse> {
    const { page, limit } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 10;

    const { items: rows, total } = await this.gameService.listPublishers({
      page: pageNum,
      limit: limitNum,
    });

    const totalPages = Math.ceil(total / limitNum);

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      countryCode: row.countryCode,
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
