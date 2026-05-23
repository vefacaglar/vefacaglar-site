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
import { and, asc, desc, eq, sql } from "drizzle-orm";
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

  private async getGameWithRelations(gameRow: Game): Promise<GameWithRelations> {
    const db = this.dbProvider.client;

    const devs = await db
      .select({
        id: developers.id,
        name: developers.name,
        slug: developers.slug,
        countryCode: developers.countryCode,
        createdAt: developers.createdAt,
        updatedAt: developers.updatedAt,
      })
      .from(gameDevelopers)
      .innerJoin(developers, eq(gameDevelopers.developerId, developers.id))
      .where(eq(gameDevelopers.gameId, gameRow.id))
      .orderBy(developers.name);

    const pubs = await db
      .select({
        id: publishers.id,
        name: publishers.name,
        slug: publishers.slug,
        countryCode: publishers.countryCode,
        createdAt: publishers.createdAt,
        updatedAt: publishers.updatedAt,
      })
      .from(gamePublishers)
      .innerJoin(publishers, eq(gamePublishers.publisherId, publishers.id))
      .where(eq(gamePublishers.gameId, gameRow.id))
      .orderBy(publishers.name);

    const gens = await db
      .select({
        id: genres.id,
        name: genres.name,
        slug: genres.slug,
        createdAt: genres.createdAt,
        updatedAt: genres.updatedAt,
      })
      .from(gameGenres)
      .innerJoin(genres, eq(gameGenres.genreId, genres.id))
      .where(eq(gameGenres.gameId, gameRow.id))
      .orderBy(genres.name);

    const plats = await db
      .select({
        id: platforms.id,
        name: platforms.name,
        slug: platforms.slug,
        createdAt: platforms.createdAt,
        updatedAt: platforms.updatedAt,
      })
      .from(gamePlatforms)
      .innerJoin(platforms, eq(gamePlatforms.platformId, platforms.id))
      .where(eq(gamePlatforms.gameId, gameRow.id))
      .orderBy(platforms.name);

    const thms = await db
      .select({
        id: themes.id,
        name: themes.name,
        slug: themes.slug,
        createdAt: themes.createdAt,
        updatedAt: themes.updatedAt,
      })
      .from(gameThemes)
      .innerJoin(themes, eq(gameThemes.themeId, themes.id))
      .where(eq(gameThemes.gameId, gameRow.id))
      .orderBy(themes.name);

    return {
      ...gameRow,
      developers: devs,
      publishers: pubs,
      genres: gens,
      platforms: plats,
      themes: thms,
    };
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
    const db = this.dbProvider.client;

    return db.transaction(async (tx) => {
      const [gameRow] = await tx.insert(games).values(values).returning();

      if (relations.developerIds && relations.developerIds.length > 0) {
        await tx.insert(gameDevelopers).values(
          relations.developerIds.map((devId) => ({
            gameId: gameRow.id,
            developerId: devId,
          }))
        );
      }

      if (relations.publisherIds && relations.publisherIds.length > 0) {
        await tx.insert(gamePublishers).values(
          relations.publisherIds.map((pubId) => ({
            gameId: gameRow.id,
            publisherId: pubId,
          }))
        );
      }

      if (relations.genreIds && relations.genreIds.length > 0) {
        await tx.insert(gameGenres).values(
          relations.genreIds.map((genId) => ({
            gameId: gameRow.id,
            genreId: genId,
          }))
        );
      }

      if (relations.platformIds && relations.platformIds.length > 0) {
        await tx.insert(gamePlatforms).values(
          relations.platformIds.map((platId) => ({
            gameId: gameRow.id,
            platformId: platId,
          }))
        );
      }

      if (relations.themeIds && relations.themeIds.length > 0) {
        await tx.insert(gameThemes).values(
          relations.themeIds.map((themeId) => ({
            gameId: gameRow.id,
            themeId: themeId,
          }))
        );
      }

      return this.getGameWithRelationsUsingTx(tx, gameRow);
    });
  }

  private async getGameWithRelationsUsingTx(tx: any, gameRow: Game): Promise<GameWithRelations> {
    const devs = await tx
      .select({
        id: developers.id,
        name: developers.name,
        slug: developers.slug,
        countryCode: developers.countryCode,
        createdAt: developers.createdAt,
        updatedAt: developers.updatedAt,
      })
      .from(gameDevelopers)
      .innerJoin(developers, eq(gameDevelopers.developerId, developers.id))
      .where(eq(gameDevelopers.gameId, gameRow.id))
      .orderBy(developers.name);

    const pubs = await tx
      .select({
        id: publishers.id,
        name: publishers.name,
        slug: publishers.slug,
        countryCode: publishers.countryCode,
        createdAt: publishers.createdAt,
        updatedAt: publishers.updatedAt,
      })
      .from(gamePublishers)
      .innerJoin(publishers, eq(gamePublishers.publisherId, publishers.id))
      .where(eq(gamePublishers.gameId, gameRow.id))
      .orderBy(publishers.name);

    const gens = await tx
      .select({
        id: genres.id,
        name: genres.name,
        slug: genres.slug,
        createdAt: genres.createdAt,
        updatedAt: genres.updatedAt,
      })
      .from(gameGenres)
      .innerJoin(genres, eq(gameGenres.genreId, genres.id))
      .where(eq(gameGenres.gameId, gameRow.id))
      .orderBy(genres.name);

    const plats = await tx
      .select({
        id: platforms.id,
        name: platforms.name,
        slug: platforms.slug,
        createdAt: platforms.createdAt,
        updatedAt: platforms.updatedAt,
      })
      .from(gamePlatforms)
      .innerJoin(platforms, eq(gamePlatforms.platformId, platforms.id))
      .where(eq(gamePlatforms.gameId, gameRow.id))
      .orderBy(platforms.name);

    const thms = await tx
      .select({
        id: themes.id,
        name: themes.name,
        slug: themes.slug,
        createdAt: themes.createdAt,
        updatedAt: themes.updatedAt,
      })
      .from(gameThemes)
      .innerJoin(themes, eq(gameThemes.themeId, themes.id))
      .where(eq(gameThemes.gameId, gameRow.id))
      .orderBy(themes.name);

    return {
      ...gameRow,
      developers: devs,
      publishers: pubs,
      genres: gens,
      platforms: plats,
      themes: thms,
    };
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

  async list(filter?: { page?: number; limit?: number }): Promise<{ items: GameWithRelations[]; total: number }> {
    const [countResult] = await this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(games);

    const total = Number(countResult?.count || 0);

    let query = this.dbProvider.client
      .select()
      .from(games)
      .orderBy(desc(games.createdAt))
      .$dynamic();

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      query = query.limit(filter.limit).offset(offset);
    }

    const rows = await query;

    const items = await Promise.all(rows.map((row) => this.getGameWithRelations(row)));
    return { items, total };
  }

  async update(id: string, patch: Partial<NewGame>): Promise<GameWithRelations> {
    const db = this.dbProvider.client;

    return db.transaction(async (tx) => {
      let gameRow: Game;
      if (Object.keys(patch).length > 0) {
        const [updated] = await tx
          .update(games)
          .set(patch)
          .where(eq(games.id, id))
          .returning();
        gameRow = updated;
      } else {
        const [existing] = await tx.select().from(games).where(eq(games.id, id)).limit(1);
        gameRow = existing;
      }

      return this.getGameWithRelationsUsingTx(tx, gameRow);
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
