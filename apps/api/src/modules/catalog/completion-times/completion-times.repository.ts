import { injectable } from "tsyringe";
import { eq, inArray, notInArray, sql } from "drizzle-orm";
import { gameIgdbCompletionTimes, games } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import type { GameCompletionTimesRow, IGameCompletionTimesRepository } from "./completion-times.types";
import { usableCompletionTimes } from "./completion-times-quality";

@injectable()
export class DrizzleGameCompletionTimesRepository implements IGameCompletionTimesRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async publish(rows: GameCompletionTimesRow[], refreshedAt: Date) {
    if (rows.length === 0 || new Set(rows.map((row) => row.igdbId)).size !== rows.length) {
      throw new Error("Refusing an empty or duplicate IGDB completion times publication");
    }
    const ids = rows.map((row) => row.igdbId);
    const usableIds = rows.filter((row) => usableCompletionTimes(row) !== null).map((row) => row.igdbId);
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      for (let offset = 0; offset < rows.length; offset += 500) {
        await db.insert(gameIgdbCompletionTimes).values(rows.slice(offset, offset + 500).map((row) => ({ ...row, refreshedAt })))
          .onConflictDoUpdate({ target: gameIgdbCompletionTimes.igdbId, set: {
            sourceId: sql`excluded.source_id`, hastilySeconds: sql`excluded.hastily_seconds`,
            normallySeconds: sql`excluded.normally_seconds`, completelySeconds: sql`excluded.completely_seconds`,
            sampleCount: sql`excluded.sample_count`, sourceUpdatedAt: sql`excluded.source_updated_at`, refreshedAt,
          } });
      }
      // collectCompletionTimes verifies both endpoint counts and every raw page
      // before this transaction can remove records missing from the complete pass.
      await db.delete(gameIgdbCompletionTimes).where(notInArray(gameIgdbCompletionTimes.igdbId, ids));
      const [matched] = await db.select({ count: sql<number>`count(*)::int` }).from(games)
        .innerJoin(gameIgdbCompletionTimes, eq(games.igdbId, gameIgdbCompletionTimes.igdbId));
      const [usable] = usableIds.length ? await db.select({ count: sql<number>`count(*)::int` }).from(games)
        .where(inArray(games.igdbId, usableIds)) : [{ count: 0 }];
      return { matchedGames: Number(matched.count), usableGames: Number(usable.count) };
    });
  }
}
