import {
  games,
  developers,
  publishers,
  genres,
  platforms,
  themes,
  gameDevelopers,
  gamePublishers,
  gameGenres,
  gamePlatforms,
  gameThemes,
} from "@vefacaglar/db";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type {
  IGamesRepository,
  Game,
  NewGame,
  GameWithRelations,
} from "./games.repository.interface";

@injectable()
export class DrizzleGamesRepository implements IGamesRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  /**
   * Loads every relation set for the given games in a fixed number of queries
   * (one per relation type), regardless of how many games are passed in. This
   * avoids the N+1 pattern of resolving relations per game.
   */
  private async attachRelations(gameRows: Game[]): Promise<GameWithRelations[]> {
    if (gameRows.length === 0) return [];

    const db = this.dbProvider.client;
    const gameIds = gameRows.map((g) => g.id);

    const devRows = await db
      .select({
        gameId: gameDevelopers.gameId,
        id: developers.id,
        name: developers.name,
        slug: developers.slug,
        countryCode: developers.countryCode,
        createdAt: developers.createdAt,
        updatedAt: developers.updatedAt,
      })
      .from(gameDevelopers)
      .innerJoin(developers, eq(gameDevelopers.developerId, developers.id))
      .where(inArray(gameDevelopers.gameId, gameIds))
      .orderBy(developers.name);

    const pubRows = await db
      .select({
        gameId: gamePublishers.gameId,
        id: publishers.id,
        name: publishers.name,
        slug: publishers.slug,
        countryCode: publishers.countryCode,
        createdAt: publishers.createdAt,
        updatedAt: publishers.updatedAt,
      })
      .from(gamePublishers)
      .innerJoin(publishers, eq(gamePublishers.publisherId, publishers.id))
      .where(inArray(gamePublishers.gameId, gameIds))
      .orderBy(publishers.name);

    const genRows = await db
      .select({
        gameId: gameGenres.gameId,
        id: genres.id,
        name: genres.name,
        slug: genres.slug,
        createdAt: genres.createdAt,
        updatedAt: genres.updatedAt,
      })
      .from(gameGenres)
      .innerJoin(genres, eq(gameGenres.genreId, genres.id))
      .where(inArray(gameGenres.gameId, gameIds))
      .orderBy(genres.name);

    const platRows = await db
      .select({
        gameId: gamePlatforms.gameId,
        id: platforms.id,
        name: platforms.name,
        slug: platforms.slug,
        createdAt: platforms.createdAt,
        updatedAt: platforms.updatedAt,
      })
      .from(gamePlatforms)
      .innerJoin(platforms, eq(gamePlatforms.platformId, platforms.id))
      .where(inArray(gamePlatforms.gameId, gameIds))
      .orderBy(platforms.name);

    const themeRows = await db
      .select({
        gameId: gameThemes.gameId,
        id: themes.id,
        name: themes.name,
        slug: themes.slug,
        createdAt: themes.createdAt,
        updatedAt: themes.updatedAt,
      })
      .from(gameThemes)
      .innerJoin(themes, eq(gameThemes.themeId, themes.id))
      .where(inArray(gameThemes.gameId, gameIds))
      .orderBy(themes.name);

    const groupByGame = <T extends { gameId: string }>(rows: T[]) => {
      const map = new Map<string, Omit<T, "gameId">[]>();
      for (const { gameId, ...rest } of rows) {
        const list = map.get(gameId) ?? [];
        list.push(rest as Omit<T, "gameId">);
        map.set(gameId, list);
      }
      return map;
    };

    const devsByGame = groupByGame(devRows);
    const pubsByGame = groupByGame(pubRows);
    const gensByGame = groupByGame(genRows);
    const platsByGame = groupByGame(platRows);
    const themesByGame = groupByGame(themeRows);

    return gameRows.map((gameRow) => ({
      ...gameRow,
      developers: devsByGame.get(gameRow.id) ?? [],
      publishers: pubsByGame.get(gameRow.id) ?? [],
      genres: gensByGame.get(gameRow.id) ?? [],
      platforms: platsByGame.get(gameRow.id) ?? [],
      themes: themesByGame.get(gameRow.id) ?? [],
    }));
  }

  private async getGameWithRelations(gameRow: Game): Promise<GameWithRelations> {
    const [withRelations] = await this.attachRelations([gameRow]);
    return withRelations;
  }

  async create(
    values: NewGame,
    relations: {
      developerIds?: string[];
      publisherIds?: string[];
      genreIds?: string[];
      platformIds?: string[];
      themeIds?: string[];
    }
  ): Promise<GameWithRelations> {
    // Implicit transaction: dbProvider.client resolves to the active tx via
    // AsyncLocalStorage, so nested calls need no tx parameter.
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const [gameRow] = await db.insert(games).values(values).returning();

      if (relations.developerIds && relations.developerIds.length > 0) {
        await db.insert(gameDevelopers).values(
          relations.developerIds.map((developerId) => ({ gameId: gameRow.id, developerId }))
        );
      }

      if (relations.publisherIds && relations.publisherIds.length > 0) {
        await db.insert(gamePublishers).values(
          relations.publisherIds.map((publisherId) => ({ gameId: gameRow.id, publisherId }))
        );
      }

      if (relations.genreIds && relations.genreIds.length > 0) {
        await db.insert(gameGenres).values(
          relations.genreIds.map((genreId) => ({ gameId: gameRow.id, genreId }))
        );
      }

      if (relations.platformIds && relations.platformIds.length > 0) {
        await db.insert(gamePlatforms).values(
          relations.platformIds.map((platformId) => ({ gameId: gameRow.id, platformId }))
        );
      }

      if (relations.themeIds && relations.themeIds.length > 0) {
        await db.insert(gameThemes).values(
          relations.themeIds.map((themeId) => ({ gameId: gameRow.id, themeId }))
        );
      }

      return this.getGameWithRelations(gameRow);
    });
  }

  async findById(id: string): Promise<GameWithRelations | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(games)
      .where(eq(games.id, id))
      .limit(1);

    if (!row) return null;
    return this.getGameWithRelations(row);
  }

  async findBySlug(slug: string): Promise<GameWithRelations | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(games)
      .where(eq(games.slug, slug))
      .limit(1);

    if (!row) return null;
    return this.getGameWithRelations(row);
  }

  async list(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: GameWithRelations[]; total: number }> {
    const q = filter?.q?.trim();
    const whereExpr = q
      ? or(
          ilike(games.title, `%${q}%`),
          ilike(games.originalTitle, `%${q}%`),
          ilike(games.slug, `%${q}%`)
        )
      : undefined;

    const countQuery = this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .$dynamic();
    if (whereExpr) countQuery.where(whereExpr);
    const [countResult] = await countQuery;

    const total = Number(countResult?.count || 0);

    let query = this.dbProvider.client
      .select()
      .from(games)
      .orderBy(desc(games.createdAt))
      .$dynamic();

    if (whereExpr) query = query.where(whereExpr);

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      query = query.limit(filter.limit).offset(offset);
    }

    const rows = await query;

    const items = await this.attachRelations(rows);
    return { items, total };
  }

  async update(id: string, patch: Partial<NewGame>): Promise<GameWithRelations> {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      let gameRow: Game;
      if (Object.keys(patch).length > 0) {
        const [updated] = await db
          .update(games)
          .set(patch)
          .where(eq(games.id, id))
          .returning();
        gameRow = updated;
      } else {
        const [existing] = await db.select().from(games).where(eq(games.id, id)).limit(1);
        gameRow = existing;
      }

      return this.getGameWithRelations(gameRow);
    });
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(games).where(eq(games.id, id));
  }

  async linkDeveloper(gameId: string, developerId: string): Promise<void> {
    await this.dbProvider.client
      .insert(gameDevelopers)
      .values({ gameId, developerId })
      .onConflictDoNothing();
  }

  async unlinkDeveloper(gameId: string, developerId: string): Promise<void> {
    await this.dbProvider.client
      .delete(gameDevelopers)
      .where(and(eq(gameDevelopers.gameId, gameId), eq(gameDevelopers.developerId, developerId)));
  }

  async linkPublisher(gameId: string, publisherId: string): Promise<void> {
    await this.dbProvider.client
      .insert(gamePublishers)
      .values({ gameId, publisherId })
      .onConflictDoNothing();
  }

  async unlinkPublisher(gameId: string, publisherId: string): Promise<void> {
    await this.dbProvider.client
      .delete(gamePublishers)
      .where(and(eq(gamePublishers.gameId, gameId), eq(gamePublishers.publisherId, publisherId)));
  }

  async linkGenre(gameId: string, genreId: string): Promise<void> {
    await this.dbProvider.client
      .insert(gameGenres)
      .values({ gameId, genreId })
      .onConflictDoNothing();
  }

  async unlinkGenre(gameId: string, genreId: string): Promise<void> {
    await this.dbProvider.client
      .delete(gameGenres)
      .where(and(eq(gameGenres.gameId, gameId), eq(gameGenres.genreId, genreId)));
  }

  async linkPlatform(gameId: string, platformId: string): Promise<void> {
    await this.dbProvider.client
      .insert(gamePlatforms)
      .values({ gameId, platformId })
      .onConflictDoNothing();
  }

  async unlinkPlatform(gameId: string, platformId: string): Promise<void> {
    await this.dbProvider.client
      .delete(gamePlatforms)
      .where(and(eq(gamePlatforms.gameId, gameId), eq(gamePlatforms.platformId, platformId)));
  }

  async linkTheme(gameId: string, themeId: string): Promise<void> {
    await this.dbProvider.client
      .insert(gameThemes)
      .values({ gameId, themeId })
      .onConflictDoNothing();
  }

  async unlinkTheme(gameId: string, themeId: string): Promise<void> {
    await this.dbProvider.client
      .delete(gameThemes)
      .where(and(eq(gameThemes.gameId, gameId), eq(gameThemes.themeId, themeId)));
  }
}
