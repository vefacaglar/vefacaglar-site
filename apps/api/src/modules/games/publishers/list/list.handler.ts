import { FastifyRequest } from "fastify";
import { ListPublishersQuery, ListPublishersResponse } from "./list.schema";
import { inject, injectable } from "tsyringe";
import { SEARCH_INDEXER } from "../../../../shared/search/search.tokens";
import type { ISearchIndexer } from "../../../../shared/search/search-indexer.interface";

@injectable()
export class ListPublishersHandler {
  constructor(@inject(SEARCH_INDEXER) private readonly searchIndexer: ISearchIndexer) {}

  async handle(request: FastifyRequest<{ Querystring: ListPublishersQuery }>): Promise<ListPublishersResponse> {
    const { page, limit, q } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 10;

    const { items: rows, total } = await this.searchIndexer.searchPublishers({
      q,
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
