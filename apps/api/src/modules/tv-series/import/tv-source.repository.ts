import { injectable } from "tsyringe";
import { and, eq, ne, inArray, notInArray, lte, sql } from "drizzle-orm";
import { tvSeries, tvGenres, tvSeriesGenres, tvSeasons, tvEpisodes, tvSourceState, tvRefreshQueue, tvPopularityScores, tvPopularityState } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { dirtyTvSearch } from "../tv-dirty";
import type { ITvSourceRepository, TvShowSource, TvHierarchy, TvRefreshItem } from "./tvmaze.types";

@injectable()
export class DrizzleTvSourceRepository implements ITvSourceRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state(now: Date) {
    let [state] = await this.dbProvider.client.select().from(tvSourceState).where(eq(tvSourceState.id, "tvmaze"));
    if (!state) throw new Error("tv_source_state_missing_migration");
    if (state.indexComplete && state.catalogCompletedAt && state.catalogCompletedAt.getTime() < now.getTime() - 30 * 86400_000) {
      [state] = await this.dbProvider.client.update(tvSourceState).set({ nextPage: 0, indexComplete: false, indexStartedAt: now })
        .where(eq(tvSourceState.id, "tvmaze")).returning();
    }
    return state;
  }
  async indexPage(page: number, shows: TvShowSource[], at: Date) {
    await this.dbProvider.transaction(async () => {
      const [state] = await this.dbProvider.client.select().from(tvSourceState).where(eq(tvSourceState.id, "tvmaze")).for("update");
      if (!state || state.nextPage !== page || state.indexComplete) throw new Error("tv_catalog_cursor_changed");
      await this.writeShows(shows, at);
      await this.dbProvider.client.update(tvSourceState).set({ nextPage: page + 1 }).where(eq(tvSourceState.id, "tvmaze"));
    });
  }
  async completeIndex(at: Date) {
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const [state] = await db.select().from(tvSourceState).where(eq(tvSourceState.id, "tvmaze")).for("update");
      if (!state || state.nextPage < 1) throw new Error("tvmaze_empty_catalog");
      // An index omission requests an individual source check. Only a show
      // endpoint's confirmed 404 can remove an existing public series.
      await db.execute(sql`insert into ${tvRefreshQueue}(series_id,requested_at,due_at)
        select id,${at.toISOString()}::timestamptz,${at.toISOString()}::timestamptz from ${tvSeries}
        where is_deleted=false and last_seen_at<${state.indexStartedAt.toISOString()}::timestamptz
        on conflict(series_id) do update set requested_at=excluded.requested_at,due_at=excluded.due_at`);
      await db.update(tvSourceState).set({ indexComplete: true, catalogCompletedAt: at }).where(eq(tvSourceState.id, "tvmaze"));
    });
  }
  async updates(rows: { id: number; updatedAt: Date }[], at: Date) {
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      for (let offset = 0; offset < rows.length; offset += 500) {
        await db.insert(tvRefreshQueue).values(rows.slice(offset, offset + 500).map((row) => ({ seriesId: row.id, sourceUpdatedAt: row.updatedAt, requestedAt: at })))
          .onConflictDoUpdate({ target: tvRefreshQueue.seriesId, set: {
            sourceUpdatedAt: sql`greatest(${tvRefreshQueue.sourceUpdatedAt},excluded.source_updated_at)`,
            requestedAt: sql`greatest(${tvRefreshQueue.requestedAt},excluded.requested_at)`, dueAt: at,
          } });
      }
      await db.update(tvSourceState).set({ updatesCheckedAt: at }).where(eq(tvSourceState.id, "tvmaze"));
    });
  }
  async candidates(limit: number, now: Date): Promise<TvRefreshItem[]> {
    const db = this.dbProvider.client;
    const popular = await db.execute(sql`select q.series_id,q.requested_at from ${tvRefreshQueue} q
      left join ${tvPopularityScores} p on p.series_id=q.series_id where q.due_at<=${now.toISOString()}::timestamptz
      order by q.priority desc, p.score desc nulls last,q.requested_at,q.series_id limit ${Math.ceil(limit / 2)}`);
    const popularIds = popular.map((row) => Number(row.series_id));
    const older = await db.select({ seriesId: tvRefreshQueue.seriesId, requestedAt: tvRefreshQueue.requestedAt }).from(tvRefreshQueue)
      .where(and(lte(tvRefreshQueue.dueAt, now), popularIds.length ? notInArray(tvRefreshQueue.seriesId, popularIds) : undefined))
      .orderBy(tvRefreshQueue.requestedAt, tvRefreshQueue.seriesId).limit(limit - popular.length);
    return [...popular.map((row) => ({ seriesId: Number(row.series_id), requestedAt: row.requested_at instanceof Date ? row.requested_at : new Date(String(row.requested_at)) })), ...older];
  }
  async hierarchy(item: TvRefreshItem, snapshot: TvHierarchy, at: Date) {
    if (snapshot.show.id !== item.seriesId || snapshot.seasons.some((row) => row.seriesId !== item.seriesId) ||
      snapshot.episodes.some((row) => row.seriesId !== item.seriesId)) throw new Error("tvmaze_hierarchy_identity_mismatch");
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const incomingSeasons = snapshot.seasons.map((row) => row.id), incomingEpisodes = snapshot.episodes.map((row) => row.id);
      if (incomingSeasons.length && (await db.select({ id: tvSeasons.id }).from(tvSeasons).where(and(inArray(tvSeasons.id, incomingSeasons), ne(tvSeasons.seriesId, item.seriesId))).limit(1)).length) throw new Error("tvmaze_season_identity_collision");
      if (incomingEpisodes.length && (await db.select({ id: tvEpisodes.id }).from(tvEpisodes).where(and(sql`${tvEpisodes.id}=any(${`{${incomingEpisodes.join(",")}}`}::int[])`, ne(tvEpisodes.seriesId, item.seriesId))).limit(1)).length) throw new Error("tvmaze_episode_identity_collision");
      const [existing] = await db.select({ episodeCount: tvSeries.episodeCount, specialCount: tvSeries.specialCount }).from(tvSeries).where(eq(tvSeries.id, item.seriesId));
      if (existing && existing.episodeCount + existing.specialCount > 0 && !snapshot.episodes.length) throw new Error("tvmaze_empty_hierarchy_regression");
      await this.writeShows([snapshot.show], at, false);
      for (let offset = 0; offset < snapshot.seasons.length; offset += 250) {
        await db.insert(tvSeasons).values(snapshot.seasons.slice(offset, offset + 250)).onConflictDoUpdate({ target: tvSeasons.id, set: {
          seriesId: sql`excluded.series_id`, number: sql`excluded.number`, name: sql`excluded.name`, summary: sql`excluded.summary`,
          premiered: sql`excluded.premiered`, ended: sql`excluded.ended`, episodeOrder: sql`excluded.episode_order`, network: sql`excluded.network`, sourceUrl: sql`excluded.source_url`,
        } });
      }
      for (let offset = 0; offset < snapshot.episodes.length; offset += 500) {
        await db.insert(tvEpisodes).values(snapshot.episodes.slice(offset, offset + 500)).onConflictDoUpdate({ target: tvEpisodes.id, set: {
          seriesId: sql`excluded.series_id`, seasonId: sql`excluded.season_id`, seasonNumber: sql`excluded.season_number`, number: sql`excluded.number`,
          name: sql`excluded.name`, summary: sql`excluded.summary`, type: sql`excluded.type`, isSpecial: sql`excluded.is_special`,
          airdate: sql`excluded.airdate`, airstamp: sql`excluded.airstamp`, runtime: sql`excluded.runtime`, rating: sql`excluded.rating`, sourceUrl: sql`excluded.source_url`,
        } });
      }
      const episodeIds = snapshot.episodes.map((row) => row.id);
      const seasonIds = snapshot.seasons.map((row) => row.id);
      await db.delete(tvEpisodes).where(and(eq(tvEpisodes.seriesId, item.seriesId), episodeIds.length ? sql`${tvEpisodes.id}<>all(${`{${episodeIds.join(",")}}`}::int[])` : undefined));
      await db.delete(tvSeasons).where(and(eq(tvSeasons.seriesId, item.seriesId), seasonIds.length ? notInArray(tvSeasons.id, seasonIds) : undefined));
      const aired = snapshot.episodes.filter((episode) => episode.airdate && episode.airdate <= at.toISOString().slice(0, 10) && (!episode.airstamp || episode.airstamp <= at))
        .map((episode) => episode.airdate!).sort();
      await db.update(tvSeries).set({ hierarchyComplete: true, hierarchyUpdatedAt: at, seasonCount: snapshot.seasons.length,
        episodeCount: snapshot.episodes.filter((episode) => !episode.isSpecial).length, specialCount: snapshot.episodes.filter((episode) => episode.isSpecial).length,
        firstAired: aired[0] ?? null, lastAired: aired[aired.length - 1] ?? null,
      }).where(eq(tvSeries.id, item.seriesId));
      await db.delete(tvRefreshQueue).where(and(eq(tvRefreshQueue.seriesId, item.seriesId), lte(tvRefreshQueue.requestedAt, item.requestedAt)));
      await db.execute(sql`insert into tv_cast_queue(series_id,requested_at,due_at) values(${item.seriesId},${at.toISOString()}::timestamptz,${at.toISOString()}::timestamptz)
        on conflict(series_id) do update set requested_at=excluded.requested_at,due_at=excluded.due_at`);
      await db.execute(sql`update recurring_jobs set next_run_at=least(coalesce(next_run_at,now()),now()) where id='catalog.tv-series.cast.refresh' and enabled and cron is not null`);
      await db.execute(sql`select pg_notify('jobs','catalog.tv-series.cast.refresh')`);
      await dirtyTvSearch(db, [item.seriesId]);
    });
  }
  async missing(item: TvRefreshItem, _at: Date) {
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const rows = await db.update(tvSeries).set({ isDeleted: true }).where(eq(tvSeries.id, item.seriesId)).returning({ id: tvSeries.id });
      await db.delete(tvRefreshQueue).where(and(eq(tvRefreshQueue.seriesId, item.seriesId), lte(tvRefreshQueue.requestedAt, item.requestedAt)));
      if (rows.length) await dirtyTvSearch(db, [item.seriesId]);
    });
  }
  async failure(item: TvRefreshItem, code: string, retryAt: Date) {
    await this.dbProvider.client.update(tvRefreshQueue).set({ failureCount: sql`${tvRefreshQueue.failureCount}+1`, errorCode: code.slice(0, 64), dueAt: retryAt })
      .where(eq(tvRefreshQueue.seriesId, item.seriesId));
  }
  async cooldown(until: Date) {
    await this.dbProvider.client.update(tvSourceState).set({ cooldownUntil: until }).where(eq(tvSourceState.id, "tvmaze"));
  }
  async hasMore(now: Date) {
    const [state] = await this.dbProvider.client.select().from(tvSourceState).where(eq(tvSourceState.id, "tvmaze"));
    if (!state?.indexComplete) return true;
    const [row] = await this.dbProvider.client.select({ id: tvRefreshQueue.seriesId }).from(tvRefreshQueue).where(lte(tvRefreshQueue.dueAt, now)).limit(1);
    return !!row;
  }
  private async writeShows(shows: TvShowSource[], at: Date, queue = true) {
    if (!shows.length) return;
    const db = this.dbProvider.client;
    const ids = shows.map((show) => show.id);
    await db.select({ id: tvPopularityState.id }).from(tvPopularityState).where(eq(tvPopularityState.id, "current")).for("share");
    const previous = await db.select({ id: tvSeries.id, sourceUpdatedAt: tvSeries.sourceUpdatedAt, complete: tvSeries.hierarchyComplete }).from(tvSeries).where(inArray(tvSeries.id, ids));
    const previousById = new Map(previous.map((row) => [row.id, row]));
    const popularity = new Map((await db.select().from(tvPopularityScores).where(inArray(tvPopularityScores.seriesId, ids))).map((row) => [row.seriesId, row]));
    const values = shows.map(({ genres: _genres, previousEpisodeId: _previous, ...show }) => ({ ...show,
      fetchedAt: at, lastSeenAt: at, isDeleted: false, popularityScore: popularity.get(show.id)?.score ?? null, popularityGeneration: popularity.get(show.id)?.generation ?? 0 }));
    await db.insert(tvSeries).values(values).onConflictDoUpdate({ target: tvSeries.id, set: {
      name: sql`excluded.name`, summary: sql`excluded.summary`, premiered: sql`excluded.premiered`, ended: sql`excluded.ended`,
      status: sql`excluded.status`, type: sql`excluded.type`, language: sql`excluded.language`, runtime: sql`excluded.runtime`, averageRuntime: sql`excluded.average_runtime`,
      network: sql`excluded.network`, webChannel: sql`excluded.web_channel`, rating: sql`excluded.rating`, sourceUrl: sql`excluded.source_url`, officialSite: sql`excluded.official_site`,
      sourceUpdatedAt: sql`excluded.source_updated_at`, fetchedAt: at, lastSeenAt: at, isDeleted: false,
      popularityScore: sql`excluded.popularity_score`, popularityGeneration: sql`excluded.popularity_generation`,
    } });
    const genres = [...new Set(shows.flatMap((show) => show.genres))];
    if (genres.length) await db.insert(tvGenres).values(genres.map((name) => ({ name }))).onConflictDoNothing();
    await db.delete(tvSeriesGenres).where(inArray(tvSeriesGenres.seriesId, ids));
    const links = shows.flatMap((show) => show.genres.map((genreName) => ({ seriesId: show.id, genreName })));
    if (links.length) await db.insert(tvSeriesGenres).values(links).onConflictDoNothing();
    if (queue) {
      const changed = shows.filter((show) => {
        const old = previousById.get(show.id);
        return !old || !old.complete || (show.sourceUpdatedAt && (!old.sourceUpdatedAt || show.sourceUpdatedAt > old.sourceUpdatedAt));
      });
      if (changed.length) await db.insert(tvRefreshQueue).values(changed.map((show) => ({ seriesId: show.id, requestedAt: at, sourceUpdatedAt: show.sourceUpdatedAt })))
        .onConflictDoUpdate({ target: tvRefreshQueue.seriesId, set: { requestedAt: at, sourceUpdatedAt: sql`excluded.source_updated_at`, dueAt: at } });
    }
    if (queue) {
      const castChanges = shows.filter(show => {
        const old = previousById.get(show.id);
        return !old || (show.sourceUpdatedAt && (!old.sourceUpdatedAt || show.sourceUpdatedAt > old.sourceUpdatedAt));
      });
      if (castChanges.length) {
        await db.execute(sql`insert into tv_cast_queue(series_id,requested_at,due_at) values ${sql.join(castChanges.map(show => sql`(${show.id},${at.toISOString()}::timestamptz,${at.toISOString()}::timestamptz)`), sql`,`) }
          on conflict(series_id) do update set requested_at=excluded.requested_at,due_at=excluded.due_at`);
        await db.execute(sql`update recurring_jobs set next_run_at=least(coalesce(next_run_at,now()),now()) where id='catalog.tv-series.cast.refresh' and enabled and cron is not null`);
        await db.execute(sql`select pg_notify('jobs','catalog.tv-series.cast.refresh')`);
      }
    }
    await dirtyTvSearch(db, ids);
  }
}
