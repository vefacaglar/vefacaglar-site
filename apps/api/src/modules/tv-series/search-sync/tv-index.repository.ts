import { injectable } from "tsyringe";
import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { tvSearchState, tvSearchDirty, tvPopularityState, tvSeries, tvSeriesGenres } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
export const TV_INDEX_REPOSITORY = Symbol("TvIndexRepository");
export type TvIndexState = typeof tvSearchState.$inferSelect;
export interface ITvIndexRepository {
  state(): Promise<TvIndexState>;
  start(): Promise<TvIndexState>;
  page(cursor: number | null, limit: number): Promise<{ ids: number[]; documents: unknown[] }>;
  advance(index: string, cursor: number | null, done: boolean): Promise<void>;
  dirty(limit: number): Promise<{ seriesId: number; revision: number }[]>;
  documents(ids: number[]): Promise<unknown[]>;
  acknowledge(rows: { seriesId: number; revision: number }[]): Promise<void>;
  prepareSwap(index: string): Promise<TvIndexState | null>;
  finishSwap(index: string): Promise<void>;
  needed(): Promise<boolean>;
}
@injectable()
export class DrizzleTvIndexRepository implements ITvIndexRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state() { const [row] = await this.dbProvider.client.select().from(tvSearchState).where(eq(tvSearchState.id, "tv_series_en")); if (!row) throw new Error("tv_search_state_missing_migration"); return row; }
  async start() {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const [state] = await db.select().from(tvSearchState).where(eq(tvSearchState.id, "tv_series_en")).for("update");
      if (!state) throw new Error("tv_search_state_missing_migration");
      if (state.buildIndex) return state;
      const token = randomBytes(6).toString("hex");
      const [row] = await db.update(tvSearchState).set({ phase: "scan", scanCursor: null, rankingReady: false, buildIndex: `tv_series_en__${Date.now()}_${token}`, buildToken: token, pendingGeneration: null })
        .where(eq(tvSearchState.id, "tv_series_en")).returning();
      return row;
    });
  }
  async page(cursor: number | null, limit: number) {
    const rows = await this.dbProvider.client.select({ id: tvSeries.id }).from(tvSeries).where(cursor === null ? undefined : gt(tvSeries.id, cursor)).orderBy(tvSeries.id).limit(limit);
    return { ids: rows.map((row) => row.id), documents: await this.documents(rows.map((row) => row.id)) };
  }
  async documents(ids: number[]) {
    if (!ids.length) return [];
    const rows = await this.dbProvider.client.select().from(tvSeries).where(and(inArray(tvSeries.id, ids), eq(tvSeries.isDeleted, false)));
    const genres = await this.dbProvider.client.select().from(tvSeriesGenres).where(inArray(tvSeriesGenres.seriesId, ids));
    return rows.map((row) => ({ id: row.id, kind: "series", title: row.name, titleSort: row.name.toLocaleLowerCase("en"), summary: row.summary, genres: genres.filter((genre) => genre.seriesId === row.id).map((genre) => genre.genreName), premiered: row.premiered, status: row.status, popularityScore: row.popularityScore ?? 0 }));
  }
  async advance(index: string, cursor: number | null, done: boolean) {
    await this.dbProvider.client.update(tvSearchState).set({ scanCursor: cursor, ...(done ? { phase: "dirty" } : {}) }).where(and(eq(tvSearchState.id, "tv_series_en"), eq(tvSearchState.buildIndex, index)));
  }
  async dirty(limit: number) { return this.dbProvider.client.select().from(tvSearchDirty).orderBy(tvSearchDirty.seriesId).limit(limit); }
  async acknowledge(rows: { seriesId: number; revision: number }[]) {
    if (!rows.length) return;
    await this.dbProvider.client.execute(sql`delete from ${tvSearchDirty} d using (values ${sql.join(rows.map((row) => sql`(${row.seriesId}::int,${row.revision}::int)`), sql`,`)}) v(id,revision) where d.series_id=v.id and d.revision=v.revision`);
  }
  async prepareSwap(index: string) {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      // Same lock order as canonical writers: ranking state, then index state.
      const [ranking] = await db.select().from(tvPopularityState).where(eq(tvPopularityState.id, "current")).for("share");
      const [state] = await db.select().from(tvSearchState).where(eq(tvSearchState.id, "tv_series_en")).for("update");
      if (!state || state.buildIndex !== index || !ranking) throw new Error("tv_index_publication_changed");
      const [dirty] = await db.select().from(tvSearchDirty).limit(1);
      if (dirty) return null;
      const [ready] = await db.update(tvSearchState).set({ phase: "swap", pendingGeneration: ranking.generation }).where(eq(tvSearchState.id, "tv_series_en")).returning();
      return ready;
    });
  }
  async finishSwap(index: string) {
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const [ranking] = await db.select().from(tvPopularityState).where(eq(tvPopularityState.id, "current")).for("share");
      const [state] = await db.select().from(tvSearchState).where(eq(tvSearchState.id, "tv_series_en")).for("update");
      if (!state || state.buildIndex !== index || state.phase !== "swap") throw new Error("tv_index_publication_changed");
      const [dirty] = await db.select().from(tvSearchDirty).limit(1);
      await db.update(tvSearchState).set({ phase: "ready", rankingReady: !dirty && ranking?.generation === state.pendingGeneration, publishedGeneration: state.pendingGeneration ?? 0, buildIndex: null, buildToken: null, pendingGeneration: null, scanCursor: null }).where(eq(tvSearchState.id, "tv_series_en"));
    });
  }
  async needed() {
    const state = await this.state();
    const [dirty] = await this.dbProvider.client.select().from(tvSearchDirty).limit(1);
    return !!state.buildIndex || state.phase !== "ready" || !!dirty || !state.rankingReady;
  }
}
