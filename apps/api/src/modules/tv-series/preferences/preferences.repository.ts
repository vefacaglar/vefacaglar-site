import { injectable } from "tsyringe";
import { and, eq, sql } from "drizzle-orm";
import { tvSeries, userTvSeriesPreferences } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import type { TvPreferences } from "./preferences.schema";
import type { ITvPreferencesRepository, TvPreferenceWriteResult } from "./preferences.repository.interface";

const emptyPreferences = (): TvPreferences => ({ rating: null, note: null, ratingVersion: 0, noteVersion: 0 });
function publicPreferences(row: typeof userTvSeriesPreferences.$inferSelect): TvPreferences {
  return { rating: row.rating, note: row.note, ratingVersion: row.ratingVersion, noteVersion: row.noteVersion };
}

@injectable()
export class DrizzleTvPreferencesRepository implements ITvPreferencesRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async find(userId: string, seriesId: number): Promise<TvPreferences | null> {
    const [series] = await this.dbProvider.client.select({ id: tvSeries.id }).from(tvSeries)
      .where(and(eq(tvSeries.id, seriesId), eq(tvSeries.isDeleted, false)));
    if (!series) return null;
    return this.stored(userId, seriesId);
  }

  private async stored(userId: string, seriesId: number): Promise<TvPreferences> {
    const [row] = await this.dbProvider.client.select().from(userTvSeriesPreferences)
      .where(and(eq(userTvSeriesPreferences.userId, userId), eq(userTvSeriesPreferences.seriesId, seriesId)));
    return row ? publicPreferences(row) : emptyPreferences();
  }

  setRating(userId: string, seriesId: number, rating: number | null, expectedVersion: number) {
    return this.setField(userId, seriesId, "rating", rating, expectedVersion);
  }

  setNote(userId: string, seriesId: number, note: string | null, expectedVersion: number) {
    return this.setField(userId, seriesId, "note", note, expectedVersion);
  }

  private async setField(userId: string, seriesId: number, field: "rating" | "note", value: string | number | null,
    expectedVersion: number): Promise<TvPreferenceWriteResult> {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      // A catalog refresh cannot hide or remove the series halfway through this write.
      const [series] = await db.select({ id: tvSeries.id }).from(tvSeries)
        .where(and(eq(tvSeries.id, seriesId), eq(tvSeries.isDeleted, false))).for("share");
      if (!series) return { kind: "missing" };
      const versionColumn = field === "rating" ? userTvSeriesPreferences.ratingVersion : userTvSeriesPreferences.noteVersion;
      const patch = field === "rating"
        ? { rating: value as number | null, ratingVersion: sql`${versionColumn} + 1`, updatedAt: new Date() }
        : { note: value as string | null, noteVersion: sql`${versionColumn} + 1`, updatedAt: new Date() };
      const owner = and(eq(userTvSeriesPreferences.userId, userId), eq(userTvSeriesPreferences.seriesId, seriesId));
      const inserted = field === "rating"
        ? { userId, seriesId, rating: value as number | null, ratingVersion: 1 }
        : { userId, seriesId, note: value as string | null, noteVersion: 1 };
      const rows = expectedVersion === 0
        ? await db.insert(userTvSeriesPreferences).values(inserted).onConflictDoUpdate({
            target: [userTvSeriesPreferences.userId, userTvSeriesPreferences.seriesId],
            set: patch, setWhere: eq(versionColumn, expectedVersion),
          }).returning()
        : await db.update(userTvSeriesPreferences).set(patch)
            .where(and(owner, eq(versionColumn, expectedVersion))).returning();
      if (rows[0]) return { kind: "saved", preferences: publicPreferences(rows[0]) };
      const current = await this.stored(userId, seriesId);
      const version = field === "rating" ? current.ratingVersion : current.noteVersion;
      // An exact retry after a lost response is acknowledged without another write.
      if (version === expectedVersion + 1 && current[field] === value) {
        return { kind: "saved", preferences: current };
      }
      return { kind: "conflict" };
    });
  }
}
