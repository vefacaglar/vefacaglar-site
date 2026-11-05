import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { SEARCH_READER } from "../../../shared/search/search.tokens";
import type { ISearchReader } from "../../../shared/search/queries/search-reader.interface";
import { publicCriticScore } from "../critic-score";
import { ListGamesQuery, ListGamesResponse } from "./list.schema";

const DEFAULT_LIMIT = 24;

@injectable()
export class ListGamesHandler {
  constructor(@inject(SEARCH_READER) private readonly searchReader: ISearchReader) {}

  async handle(request: FastifyRequest<{ Querystring: ListGamesQuery }>): Promise<ListGamesResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? DEFAULT_LIMIT;
    const q = request.query.q?.trim() || undefined;

    const { items, total } = await this.searchReader.searchPublicGames({ page, limit, q });
    return {
      items: items.map((g) => ({
        slug: g.slug,
        title: g.title,
        coverImageUrl: g.coverImageUrl,
        releaseDate: g.releaseDate,
        metacriticScore: publicReviewScore(g.metacriticScore),
        openCriticScore: publicReviewScore(g.openCriticScore),
        criticScore: publicReviewScore(publicCriticScore(g.criticScore, g.criticScoreCount)),
        popularityScore: Number.isFinite(g.popularityScore) && g.popularityScore! >= 0 && g.popularityScore! <= 1 ? g.popularityScore : null,
        hltbMainHours: publicHours(g.hltbMainHours),
        hltbMainExtraHours: publicHours(g.hltbMainExtraHours),
        hltbCompletionistHours: publicHours(g.hltbCompletionistHours),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

function publicReviewScore(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function publicHours(value: string | null | undefined): string | null {
  const hours = Number(value);
  return value != null && Number.isFinite(hours) && hours > 0 && hours < 100_000 ? value : null;
}
