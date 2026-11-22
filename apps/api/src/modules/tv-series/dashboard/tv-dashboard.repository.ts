import { injectable } from "tsyringe";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { tvSeries } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import type { ITvDashboardRepository, TvDashboardFilter } from "./tv-dashboard.repository.interface";

@injectable()
export class DrizzleTvDashboardRepository implements ITvDashboardRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async stats() {
    const [row] = await this.dbProvider.client.select({
      total: count(),
      complete: sql<number>`count(*) filter (where ${tvSeries.hierarchyComplete})`.mapWith(Number),
      pending: sql<number>`count(*) filter (where not ${tvSeries.hierarchyComplete})`.mapWith(Number),
      seasons: sql<number>`coalesce(sum(${tvSeries.seasonCount}) filter (where ${tvSeries.hierarchyComplete}), 0)`.mapWith(Number),
      episodes: sql<number>`coalesce(sum(${tvSeries.episodeCount}) filter (where ${tvSeries.hierarchyComplete}), 0)`.mapWith(Number),
      specials: sql<number>`coalesce(sum(${tvSeries.specialCount}) filter (where ${tvSeries.hierarchyComplete}), 0)`.mapWith(Number),
    }).from(tvSeries).where(eq(tvSeries.isDeleted, false));
    return row!;
  }

  async list(filter: TvDashboardFilter) {
    const escaped = filter.q?.replace(/[\\%_]/g, "\\$&");
    const where = and(
      eq(tvSeries.isDeleted, false),
      filter.hydration === "all" ? undefined : eq(tvSeries.hierarchyComplete, filter.hydration === "complete"),
      escaped ? sql`${tvSeries.name} ilike ${`%${escaped}%`} escape '\\'` : undefined,
    );
    const [items, totals] = await Promise.all([
      this.dbProvider.client.select({ id: tvSeries.id, title: tvSeries.name, sourceUrl: tvSeries.sourceUrl,
        hierarchyComplete: tvSeries.hierarchyComplete, seasonCount: tvSeries.seasonCount, episodeCount: tvSeries.episodeCount,
        specialCount: tvSeries.specialCount, hierarchyUpdatedAt: tvSeries.hierarchyUpdatedAt, fetchedAt: tvSeries.fetchedAt })
        .from(tvSeries).where(where).orderBy(asc(tvSeries.id)).limit(filter.limit).offset((filter.page - 1) * filter.limit),
      this.dbProvider.client.select({ total: count() }).from(tvSeries).where(where),
    ]);
    return { items, total: totals[0]?.total ?? 0 };
  }
}
