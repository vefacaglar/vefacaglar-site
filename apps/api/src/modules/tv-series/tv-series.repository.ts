import { injectable } from "tsyringe";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { tvSeries, tvSeriesGenres, tvSeasons, tvEpisodes, tvPopularityState, tvSearchState } from "@vefacaglar/db";
import { DbProvider } from "../../db.provider";
import { tvRankingMetadata } from "./popularity/tv-ranking";
import type { ITvSeriesRepository, TvSearchPublication, TvSeriesFilter } from "./tv-series.repository.interface";
import type { TvSeriesCard } from "./list/list.schema";
import type { TvSeriesDetail, TvSeasonSummary } from "./detail/detail.schema";
import type { TvSeasonDetail } from "./season/season.schema";
import type { TvEpisode } from "./tv-episode.schema";
type SeriesRow = typeof tvSeries.$inferSelect;
type SeasonRow = typeof tvSeasons.$inferSelect;
type EpisodeRow = typeof tvEpisodes.$inferSelect;
function safeSite(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function timestamp(value: Date | string | null): string | null {
  return value instanceof Date ? value.toISOString() : value;
}
function episode(row: EpisodeRow): TvEpisode {
  return { id: row.id, isSpecial: row.isSpecial, number: row.number, name: row.name, summary: row.summary, type: row.type,
    airdate: row.airdate, airstamp: timestamp(row.airstamp), runtimeMinutes: row.runtime, rating: row.rating,
    sourceUrl: `https://www.tvmaze.com/episodes/${row.id}` };
}
@injectable()
export class DrizzleTvSeriesRepository implements ITvSeriesRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async searchPublication(): Promise<TvSearchPublication> {
    const [popularity, search] = await Promise.all([
      this.dbProvider.client.select().from(tvPopularityState).where(eq(tvPopularityState.id, "current")).then((rows) => rows[0]),
      this.dbProvider.client.select().from(tvSearchState).where(eq(tvSearchState.id, "tv_series_en")).then((rows) => rows[0]),
    ]);
    const generation = popularity?.generation ?? 0;
    return { generation, ranking: tvRankingMetadata(popularity?.sources ?? [], new Date()),
      ready: !!search && search.schemaVersion === 1 && search.phase === "ready" && search.rankingReady && search.publishedGeneration === generation };
  }
  async listPublic(filter: TvSeriesFilter) {
    const publication = await this.searchPublication();
    const q = filter.q?.trim();
    if (q && !/[\p{L}\p{N}]/u.test(q)) return { items: [], total: 0, ranking: publication.ranking };
    const titleMatch = q ? sql`strpos(lower(${tvSeries.name}), lower(${q})) > 0` : undefined;
    const where = and(eq(tvSeries.isDeleted, false), titleMatch);
    const score = publication.ranking.isFresh
      ? sql`case when ${tvSeries.popularityGeneration} = ${publication.generation} then coalesce(${tvSeries.popularityScore}, 0) else 0 end`
      : sql`0`;
    const [rows, totals] = await Promise.all([
      this.dbProvider.client.select().from(tvSeries).where(where)
        .orderBy(sql`${score} desc`, sql`lower(${tvSeries.name}) asc`, asc(tvSeries.id)).limit(filter.limit).offset((filter.page - 1) * filter.limit),
      this.dbProvider.client.select({ total: sql<number>`count(*)::int` }).from(tvSeries).where(where),
    ]);
    return { items: await this.cards(rows), total: totals[0]?.total ?? 0, ranking: publication.ranking };
  }
  async hydrateCards(ids: number[]): Promise<TvSeriesCard[]> {
    if (!ids.length) return [];
    const rows = await this.dbProvider.client.select().from(tvSeries).where(and(eq(tvSeries.isDeleted, false), inArray(tvSeries.id, ids)));
    const cards = new Map((await this.cards(rows)).map((row) => [row.id, row]));
    return ids.flatMap((id) => cards.has(id) ? [cards.get(id)!] : []);
  }
  private async cards(rows: SeriesRow[]): Promise<TvSeriesCard[]> {
    if (!rows.length) return [];
    const links = await this.dbProvider.client.select().from(tvSeriesGenres).where(inArray(tvSeriesGenres.seriesId, rows.map((row) => row.id))).orderBy(asc(tvSeriesGenres.genreName));
    const genres = new Map<number, string[]>();
    for (const link of links) genres.set(link.seriesId, [...(genres.get(link.seriesId) ?? []), link.genreName]);
    return rows.map((row) => ({ id: row.id, title: row.name, summary: row.summary, premiered: row.premiered, ended: row.ended,
      status: row.status, genres: genres.get(row.id) ?? [], rating: row.rating, ratingSource: "tvmaze", sourceUrl: `https://www.tvmaze.com/shows/${row.id}`,
      seasonCount: row.hierarchyComplete ? row.seasonCount : null, episodeCount: row.hierarchyComplete ? row.episodeCount : null,
      specialCount: row.hierarchyComplete ? row.specialCount : null }));
  }
  async findPublic(id: number): Promise<TvSeriesDetail | null> {
    const [row] = await this.dbProvider.client.select().from(tvSeries).where(and(eq(tvSeries.id, id), eq(tvSeries.isDeleted, false)));
    if (!row) return null;
    const [card] = await this.cards([row]);
    const [seasons, orphans] = await Promise.all([
      this.seasons(id, row.hierarchyComplete),
      this.dbProvider.client.select().from(tvEpisodes).where(and(eq(tvEpisodes.seriesId, id), eq(tvEpisodes.isSpecial, true), isNull(tvEpisodes.seasonId)))
        .orderBy(asc(tvEpisodes.airdate), asc(tvEpisodes.id)),
    ]);
    return { ...card, language: row.language, type: row.type, runtimeMinutes: row.runtime ?? row.averageRuntime,
      officialSite: safeSite(row.officialSite), network: row.webChannel ?? row.network, firstAired: row.firstAired, lastAired: row.lastAired,
      updatedAt: timestamp(row.fetchedAt)!, hierarchyUpdatedAt: timestamp(row.hierarchyUpdatedAt),
      hierarchyStatus: row.hierarchyComplete ? "complete" : "pending", seasons, orphanSpecials: orphans.map(episode) };
  }
  private async seasons(seriesId: number, complete: boolean): Promise<TvSeasonSummary[]> {
    const [seasons, counts] = await Promise.all([
      this.dbProvider.client.select().from(tvSeasons).where(eq(tvSeasons.seriesId, seriesId)).orderBy(asc(tvSeasons.number), asc(tvSeasons.id)),
      this.dbProvider.client.select({ seasonId: tvEpisodes.seasonId,
        regular: sql<number>`count(*) filter (where not ${tvEpisodes.isSpecial})::int`,
        specials: sql<number>`count(*) filter (where ${tvEpisodes.isSpecial})::int` })
        .from(tvEpisodes).where(eq(tvEpisodes.seriesId, seriesId)).groupBy(tvEpisodes.seasonId),
    ]);
    const bySeason = new Map(counts.map((count) => [count.seasonId, count]));
    return seasons.map((season) => this.seasonSummary(season, complete ? bySeason.get(season.id) ?? { regular: 0, specials: 0 } : undefined));
  }
  private seasonSummary(row: SeasonRow, counts?: { regular: number; specials: number }): TvSeasonSummary {
    return { id: row.id, number: row.number, name: row.name, summary: row.summary, episodeOrder: row.episodeOrder, network: row.network, premiered: row.premiered, ended: row.ended,
      episodeCount: counts?.regular ?? null, specialCount: counts?.specials ?? null };
  }
  async findSeason(seriesId: number, seasonId: number): Promise<TvSeasonDetail | null> {
    const [series] = await this.dbProvider.client.select({ id: tvSeries.id, title: tvSeries.name, hierarchyComplete: tvSeries.hierarchyComplete })
      .from(tvSeries).where(and(eq(tvSeries.id, seriesId), eq(tvSeries.isDeleted, false)));
    if (!series) return null;
    const [season] = await this.dbProvider.client.select().from(tvSeasons).where(and(eq(tvSeasons.id, seasonId), eq(tvSeasons.seriesId, seriesId)));
    if (!season) return null;
    const episodes = await this.dbProvider.client.select().from(tvEpisodes).where(and(eq(tvEpisodes.seasonId, seasonId), eq(tvEpisodes.seriesId, seriesId)))
      .orderBy(asc(tvEpisodes.isSpecial), asc(tvEpisodes.number), asc(tvEpisodes.airdate), asc(tvEpisodes.id));
    const regular = episodes.filter((item) => !item.isSpecial).length;
    return { series: { id: series.id, title: series.title },
      season: this.seasonSummary(season, series.hierarchyComplete ? { regular, specials: episodes.length - regular } : undefined),
      episodes: episodes.map(episode), hierarchyStatus: series.hierarchyComplete ? "complete" : "pending",
      sourceUrl: `https://www.tvmaze.com/seasons/${seasonId}` };
  }
}
