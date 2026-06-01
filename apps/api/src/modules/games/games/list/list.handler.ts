import { FastifyRequest } from "fastify";
import { ListGamesQuery, ListGamesResponse } from "./list.schema";
import { inject, injectable } from "tsyringe";
import { SEARCH_READER } from "../../../../shared/search/search.tokens";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";

@injectable()
export class ListGamesHandler {
  constructor(@inject(SEARCH_READER) private readonly searchReader: ISearchReader) {}

  async handle(request: FastifyRequest<{ Querystring: ListGamesQuery }>): Promise<ListGamesResponse> {
    const { page, limit, q } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 10;

    const { items: rows, total } = await this.searchReader.searchGames({
      q,
      page: pageNum,
      limit: limitNum,
    });

    const totalPages = Math.ceil(total / limitNum);

    const items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      originalTitle: row.originalTitle,
      description: row.description,
      coverImageUrl: row.coverImageUrl,
      releaseDate: row.releaseDate,
      metacriticScore: row.metacriticScore,
      openCriticScore: row.openCriticScore,
      hltbMainHours: row.hltbMainHours,
      hltbMainExtraHours: row.hltbMainExtraHours,
      hltbCompletionistHours: row.hltbCompletionistHours,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,

      developers: row.developers.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
      publishers: row.publishers.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
      genres: row.genres.map((g) => ({ id: g.id, name: g.name, slug: g.slug })),
      platforms: row.platforms.map((pl) => ({ id: pl.id, name: pl.name, slug: pl.slug })),
      themes: row.themes.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
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
