import { injectable } from "tsyringe";
import { and, count, desc, eq, gt, isNotNull, lte, sql } from "drizzle-orm";
import { games, userGames, users } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import type { IGameCommunityRepository } from "./community.repository.interface";

/** Public projections are deliberately independent of the owner's private log DTO. */
@injectable()
export class DrizzleGameCommunityRepository implements IGameCommunityRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findPublicGameId(slug: string): Promise<string | null> {
    const [row] = await this.dbProvider.client.select({ id: games.id }).from(games).where(eq(games.slug, slug)).limit(1);
    return row?.id ?? null;
  }

  async getCommunity(gameId: string, page: number, limit: number) {
    const publicAuthor = and(eq(users.isActive, true), eq(users.isProfilePublic, true));
    const shared = and(eq(userGames.gameId, gameId), publicAuthor, isNotNull(userGames.sharedAt));
    // A repeat play log must not give its author another vote. Clearing a later rating falls back to the latest rated log.
    const latest = this.dbProvider.client.selectDistinctOn([userGames.userId], { rating: userGames.rating })
      .from(userGames).innerJoin(users, eq(userGames.userId, users.id))
      .where(and(eq(userGames.gameId, gameId), publicAuthor, gt(userGames.rating, 0), lte(userGames.rating, 100)))
      .orderBy(userGames.userId, desc(userGames.createdAt), desc(userGames.id)).as("latest_user_ratings");
    const [ratings, totals, rows] = await Promise.all([
      this.dbProvider.client.select({ average: sql<number | null>`round(avg(${latest.rating})::numeric, 1)::double precision`, count: count() }).from(latest),
      this.dbProvider.client.select({ total: count() }).from(userGames).innerJoin(users, eq(userGames.userId, users.id)).where(shared),
      this.dbProvider.client.select({
        id: userGames.id,
        author: { username: users.username, displayName: users.displayName },
        sharedAt: userGames.sharedAt,
        text: userGames.reviewText,
        rating: userGames.rating,
        status: userGames.status,
        startedAt: userGames.startedAt,
        completedAt: userGames.completedAt,
      }).from(userGames).innerJoin(users, eq(userGames.userId, users.id)).where(shared)
        .orderBy(desc(userGames.sharedAt), desc(userGames.id)).limit(limit).offset((page - 1) * limit),
    ]);
    return {
      rating: { average: ratings[0]?.average == null ? null : Number(ratings[0].average), count: Number(ratings[0]?.count ?? 0) },
      entries: rows.map((row) => ({ ...row, sharedAt: row.sharedAt!, rating: row.rating != null && row.rating > 0 && row.rating <= 100 ? row.rating : null })),
      total: Number(totals[0]?.total ?? 0),
    };
  }
}
