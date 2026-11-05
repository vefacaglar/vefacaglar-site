import { acceptBackgroundMapping } from "./hltb/hltb-policy";
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
  gamePopularitySignals,
  gameHltbPopularity,
} from "@vefacaglar/db";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, lt, gt, or, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type {
  CatalogImportWrite,
  CatalogImportWriteResult,
  CatalogIndex,
  CatalogLookupKind,
  CatalogLookupRow,
  GameCard,
  IGamesRepository,
  Game,
  NewGame,
  GameWithRelations,
  PopularitySource,
  PopularityWrite,
} from "./games.repository.interface";
import type { GameModeCandidate, GameModeCursor, OwnerRankingSource } from "./popularity/owner-ranking.types";

const LOOKUP_KINDS: CatalogLookupKind[] = ["developer", "publisher", "genre", "platform", "theme"];

const LOOKUP_TABLES = {
  developer: developers,
  publisher: publishers,
  genre: genres,
  platform: platforms,
  theme: themes,
};

// Each join table with its lookup-side column, so links can be written generically.
const LINK_TABLES = {
  developer: { table: gameDevelopers, column: "developerId" },
  publisher: { table: gamePublishers, column: "publisherId" },
  genre: { table: gameGenres, column: "genreId" },
  platform: { table: gamePlatforms, column: "platformId" },
  theme: { table: gameThemes, column: "themeId" },
} as const;

// Postgres caps a statement at 65535 bind parameters; this keeps every bulk insert well below it.
const INSERT_CHUNK = 1000;

// Domain metadata is read with indexed EXISTS clauses, without fan-out or per-game queries.
const OWNER_METADATA = {
  hasAction: sql<boolean>`exists (
    select 1 from ${gameThemes} inner join ${themes} on ${gameThemes.themeId} = ${themes.id}
    where ${gameThemes.gameId} = ${games.id} and ${themes.slug} = 'action'
  ) or exists (
    select 1 from ${gameGenres} inner join ${genres} on ${gameGenres.genreId} = ${genres.id}
    where ${gameGenres.gameId} = ${games.id} and ${genres.slug} = 'action'
  )`,
  hasRpg: sql<boolean>`exists (
    select 1 from ${gameGenres} inner join ${genres} on ${gameGenres.genreId} = ${genres.id}
    where ${gameGenres.gameId} = ${games.id} and ${genres.slug} in ('role-playing-rpg', 'rpg')
  )`,
  hasOpenWorld: sql<boolean>`exists (
    select 1 from ${gameThemes} inner join ${themes} on ${gameThemes.themeId} = ${themes.id}
    where ${gameThemes.gameId} = ${games.id} and ${themes.slug} = 'open-world'
  )`,
};

function chunks<T>(items: T[], size = INSERT_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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

    const [devRows, pubRows, genRows, platRows, themeRows] = await Promise.all([
      db
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
        .orderBy(developers.name),
      db
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
        .orderBy(publishers.name),
      db
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
        .orderBy(genres.name),
      db
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
        .orderBy(platforms.name),
      db
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
        .orderBy(themes.name),
    ]);

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

    // Full rows: search reindexing maps these into documents (description, critic scores).
    let dataQuery = this.dbProvider.client
      .select()
      .from(games)
      .orderBy(desc(games.createdAt), asc(games.id))
      .$dynamic();

    if (whereExpr) dataQuery = dataQuery.where(whereExpr);

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      dataQuery = dataQuery.limit(filter.limit).offset(offset);
    }

    const [countResult, rows] = await Promise.all([countQuery, dataQuery]);
    const total = Number(countResult[0]?.count || 0);

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

  async listPublic(filter: { page: number; limit: number; q?: string }): Promise<{ items: GameCard[]; total: number }> {
    const db = this.dbProvider.client;
    const q = filter.q?.trim();
    // Escape LIKE wildcards so a search for "100%" matches literally.
    const pattern = q?.replace(/[\\%_]/g, (c) => `\\${c}`);
    // Current interest can include announced games and games without a release date.
    const whereExpr = pattern ? ilike(games.title, `%${pattern}%`) : undefined;
    // Matches games_recommendation_score_idx. Before the first refresh, null recommendations retain interest order.
    const popularOrder = [
      sql`${games.recommendationScore} desc nulls last`,
      sql`${games.popularityScore} desc nulls last`,
      asc(games.title),
      asc(games.id),
    ];
    const order = pattern
      ? [
          asc(sql`case when lower(${games.title}) = lower(${q}) then 0 when ${games.title} ilike ${`${pattern}%`} then 1 else 2 end`),
          ...popularOrder,
        ]
      : popularOrder;

    const [countResult, rows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(games).where(whereExpr),
      db
        .select({
          id: games.id,
          slug: games.slug,
          title: games.title,
          coverImageUrl: games.coverImageUrl,
          releaseDate: games.releaseDate,
          metacriticScore: games.metacriticScore,
          openCriticScore: games.openCriticScore,
          criticScore: games.criticScore,
          criticScoreCount: games.criticScoreCount,
          popularityScore: games.popularityScore,
          hltbMainHours: games.hltbMainHours,
          hltbMainExtraHours: games.hltbMainExtraHours,
          hltbCompletionistHours: games.hltbCompletionistHours,
        })
        .from(games)
        .where(whereExpr)
        .orderBy(...order)
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit),
    ]);
    return { items: rows, total: Number(countResult[0]?.count || 0) };
  }

  async loadCatalogIndex(): Promise<CatalogIndex> {
    const db = this.dbProvider.client;
    const [gameRows, devRows, pubRows, genRows, platRows, themeRows] = await Promise.all([
      db
        .select({ id: games.id, slug: games.slug, igdbId: games.igdbId, title: games.title, originalTitle: games.originalTitle, releaseDate: games.releaseDate })
        .from(games),
      db.select({ id: developers.id, slug: developers.slug }).from(developers),
      db.select({ id: publishers.id, slug: publishers.slug }).from(publishers),
      db.select({ id: genres.id, slug: genres.slug }).from(genres),
      db.select({ id: platforms.id, slug: platforms.slug }).from(platforms),
      db.select({ id: themes.id, slug: themes.slug }).from(themes),
    ]);
    return {
      games: gameRows,
      developers: devRows,
      publishers: pubRows,
      genres: genRows,
      platforms: platRows,
      themes: themeRows,
    };
  }

  async findByIds(ids: string[]): Promise<GameWithRelations[]> {
    if (ids.length === 0) return [];
    const rows = await this.dbProvider.client.select().from(games).where(inArray(games.id, ids));
    return this.attachRelations(rows);
  }

  async findLookupsByIds(kind: CatalogLookupKind, ids: string[]): Promise<CatalogLookupRow[]> {
    if (ids.length === 0) return [];
    // The lookup tables share id/name/slug columns; the cast only narrows the type for Drizzle.
    const table = LOOKUP_TABLES[kind] as typeof genres;
    return this.dbProvider.client.select().from(table).where(inArray(table.id, ids));
  }

  async listPopularitySources(): Promise<PopularitySource[]> {
    const rows = await this.dbProvider.client
      .select({
        id: games.id,
        igdbId: games.igdbId,
        igdbRatingCount: games.igdbRatingCount,
        popularityScore: games.popularityScore,
        recommendationScore: games.recommendationScore,
        gameModeIds: games.gameModeIds,
        ...OWNER_METADATA,
        title: games.title,
        originalTitle: games.originalTitle,
        releaseDate: games.releaseDate,
        hltb: {
          hltbId: gameHltbPopularity.hltbId,
          completed: gameHltbPopularity.completed,
          backlog: gameHltbPopularity.backlog,
          playing: gameHltbPopularity.playing,
          updatedAt: gameHltbPopularity.updatedAt,
        },
      })
      .from(games)
      .leftJoin(gameHltbPopularity, eq(gameHltbPopularity.gameId, games.id))
      .where(isNotNull(games.igdbId));
    return rows.map((r) => ({ ...r, igdbId: r.igdbId! }));
  }

  async findOwnerRankingSource(gameId: string): Promise<OwnerRankingSource | null> {
    const [row] = await this.dbProvider.client.select({
      id: games.id,
      gameModeIds: games.gameModeIds,
      popularityScore: games.popularityScore,
      recommendationScore: games.recommendationScore,
      ...OWNER_METADATA,
    }).from(games).where(eq(games.id, gameId)).limit(1);
    return row ?? null;
  }

  async listGameModeCandidates(cursor: GameModeCursor | null, limit: number, staleBefore: Date): Promise<GameModeCandidate[]> {
    const after = !cursor ? undefined : cursor.popularityScore === null
      ? and(isNull(games.popularityScore), gt(games.id, cursor.id))
      : or(
          lt(games.popularityScore, cursor.popularityScore),
          isNull(games.popularityScore),
          and(eq(games.popularityScore, cursor.popularityScore), gt(games.id, cursor.id))
        );
    const rows = await this.dbProvider.client.select({
      id: games.id,
      igdbId: games.igdbId,
      popularityScore: games.popularityScore,
    }).from(games).where(and(
      isNotNull(games.igdbId),
      or(isNull(games.gameModesCheckedAt), lt(games.gameModesCheckedAt, staleBefore)),
      or(OWNER_METADATA.hasAction, OWNER_METADATA.hasRpg, OWNER_METADATA.hasOpenWorld),
      after
    )).orderBy(sql`${games.popularityScore} desc nulls last`, asc(games.id))
      .limit(Math.max(1, Math.min(500, Math.trunc(limit))));
    return rows.map((row) => ({ ...row, igdbId: row.igdbId! }));
  }

  async writeGameModes(updates: { id: string; gameModeIds: number[] | null }[], checkedAt: Date): Promise<void> {
    if (updates.length === 0) return;
    await this.dbProvider.transaction(async () => {
      for (const chunk of chunks(updates, 500)) {
        const values = sql.join(chunk.map((row) => sql`(${row.id}::uuid, ${row.gameModeIds === null ? null : JSON.stringify(row.gameModeIds)}::jsonb)`), sql`, `);
        await this.dbProvider.client.execute(sql`
          update ${games}
          set game_mode_ids = case when v.modes is null then ${games.gameModeIds}
              else array(select jsonb_array_elements_text(v.modes)::integer) end,
              game_modes_checked_at = ${checkedAt.toISOString()}::timestamptz
          from (values ${values}) as v(id, modes)
          where ${games.id} = v.id
        `);
      }
    });
  }

  async writePopularity(write: PopularityWrite): Promise<void> {
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;

      if (write.popularityTypes.length > 0) {
        await db.delete(gamePopularitySignals).where(inArray(gamePopularitySignals.popularityType, write.popularityTypes));
      }
      for (const chunk of chunks(write.signals)) {
        await db.insert(gamePopularitySignals).values(chunk);
      }

      // Acquire the entire external-ID lock set before any game row lock. A manual
      // remap takes external ID then game; interleaving per-row locks here can deadlock.
      for (const id of [...new Set(write.hltbUpdates.map((row) => row.hltbId))].sort((a, b) => a - b)) {
        await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hltb:mapping:${id}`}, 0))`);
      }
      const hltbGameIds = [...new Set(write.hltbUpdates.map((row) => row.gameId))].sort();
      if (hltbGameIds.length) await db.select({ id: games.id }).from(games).where(inArray(games.id, hltbGameIds)).orderBy(games.id).for("update");
      for (const update of write.hltbUpdates) {
        const { times, ...snapshot } = update;
        const [existing] = await db.select().from(gameHltbPopularity).where(eq(gameHltbPopularity.gameId, update.gameId));
        const [owner] = await db.select({ gameId: gameHltbPopularity.gameId }).from(gameHltbPopularity).where(eq(gameHltbPopularity.hltbId, update.hltbId));
        if (!acceptBackgroundMapping(update.gameId, update.hltbId, existing?.hltbId ?? null, owner?.gameId ?? null)) continue;
        await db.insert(gameHltbPopularity).values(snapshot).onConflictDoUpdate({
          target: gameHltbPopularity.gameId,
          set: { completed: update.completed, backlog: update.backlog, playing: update.playing, updatedAt: update.updatedAt },
        });
        // Supplement existing games without replacing manually curated or previously fetched times.
        if (Object.values(times).some((value) => value !== null)) {
          await db.update(games).set({
            hltbMainHours: sql`coalesce(${games.hltbMainHours}, ${times.mainHours?.toString() ?? null}::numeric)`,
            hltbMainExtraHours: sql`coalesce(${games.hltbMainExtraHours}, ${times.mainExtraHours?.toString() ?? null}::numeric)`,
            hltbCompletionistHours: sql`coalesce(${games.hltbCompletionistHours}, ${times.completionistHours?.toString() ?? null}::numeric)`,
          }).where(eq(games.id, update.gameId));
        }
      }

      // Interest and recommendation scores commit together, with bounded bulk statements.
      const recommendationById = new Map(write.recommendationScores.map((score) => [score.id, score.score]));
      for (const chunk of chunks(write.scores)) {
        const values = sql.join(
          chunk.map((s) => sql`(${s.id}::uuid, ${s.score}::double precision, ${recommendationById.get(s.id) ?? null}::double precision)`),
          sql`, `
        );
        await db.execute(sql`
          update ${games}
          set popularity_score = v.score, popularity_updated_at = ${write.updatedAt.toISOString()}::timestamptz,
              recommendation_score = v.recommendation_score, recommendation_version = ${write.recommendationVersion},
              recommendation_updated_at = ${write.updatedAt.toISOString()}::timestamptz
          from (values ${values}) as v(id, score, recommendation_score)
          where ${games.id} = v.id
        `);
      }
    });
  }

  async writeImportPage(write: CatalogImportWrite): Promise<CatalogImportWriteResult> {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;

      // Queries without a data dependency are issued together: postgres.js
      // pipelines them on the transaction's connection, so a page pays a few
      // round trips instead of one per row.
      const lookups = {} as CatalogImportWriteResult["lookups"];
      const lookupIds = {} as Record<CatalogLookupKind, Map<string, string>>;
      await Promise.all(LOOKUP_KINDS.map(async (kind) => {
        const table = LOOKUP_TABLES[kind] as typeof genres;
        const items = [...new Map(write.lookups[kind].map((i) => [i.slug, i])).values()];
        const created = new Set<string>();
        const rows: { id: string; slug: string }[] = [];
        for (const chunk of chunks(items)) {
          const inserted = await db
            .insert(table)
            .values(chunk.map((i) => ({ name: i.name, slug: i.slug })))
            .onConflictDoNothing({ target: table.slug })
            .returning({ slug: table.slug });
          for (const r of inserted) created.add(r.slug);
          rows.push(
            ...(await db
              .select({ id: table.id, slug: table.slug })
              .from(table)
              .where(inArray(table.slug, chunk.map((i) => i.slug))))
          );
        }
        lookups[kind] = rows.map((r) => ({ ...r, created: created.has(r.slug) }));
        lookupIds[kind] = new Map(rows.map((r) => [r.slug, r.id]));
      }));

      const insertedGameIds: string[] = [];
      for (const chunk of chunks(write.newGames, 500)) {
        // A slug or IGDB id taken since the index was loaded skips that row instead of failing the page.
        const rows = await db.insert(games).values(chunk).onConflictDoNothing().returning({ id: games.id });
        insertedGameIds.push(...rows.map((r) => r.id));
      }

      await Promise.all(write.gameUpdates.map(({ id, patch }) => db.update(games).set(patch).where(eq(games.id, id))));

      const inserted = new Set(insertedGameIds);
      const notInserted = new Set(write.newGames.map((g) => g.id!).filter((id) => !inserted.has(id)));
      await Promise.all(LOOKUP_KINDS.map(async (kind) => {
        const { table, column } = LINK_TABLES[kind];
        const rows = write.links[kind].flatMap((link) => {
          const lookupId = lookupIds[kind].get(link.slug);
          return lookupId && !notInserted.has(link.gameId) ? [{ gameId: link.gameId, [column]: lookupId }] : [];
        });
        for (const chunk of chunks(rows)) {
          // Same shape for every join table (gameId + one lookup id); the cast only satisfies Drizzle's typing.
          await db
            .insert(table as typeof gameGenres)
            .values(chunk as unknown as (typeof gameGenres.$inferInsert)[])
            .onConflictDoNothing();
        }
      }));

      return { insertedGameIds, lookups };
    });
  }

  async findGameIdsByRelation(
    relation: "developer" | "publisher" | "genre" | "platform" | "theme",
    relatedId: string
  ): Promise<string[]> {
    const db = this.dbProvider.client;
    switch (relation) {
      case "developer": {
        const rows = await db
          .select({ gameId: gameDevelopers.gameId })
          .from(gameDevelopers)
          .where(eq(gameDevelopers.developerId, relatedId));
        return rows.map((r) => r.gameId);
      }
      case "publisher": {
        const rows = await db
          .select({ gameId: gamePublishers.gameId })
          .from(gamePublishers)
          .where(eq(gamePublishers.publisherId, relatedId));
        return rows.map((r) => r.gameId);
      }
      case "genre": {
        const rows = await db
          .select({ gameId: gameGenres.gameId })
          .from(gameGenres)
          .where(eq(gameGenres.genreId, relatedId));
        return rows.map((r) => r.gameId);
      }
      case "platform": {
        const rows = await db
          .select({ gameId: gamePlatforms.gameId })
          .from(gamePlatforms)
          .where(eq(gamePlatforms.platformId, relatedId));
        return rows.map((r) => r.gameId);
      }
      case "theme": {
        const rows = await db
          .select({ gameId: gameThemes.gameId })
          .from(gameThemes)
          .where(eq(gameThemes.themeId, relatedId));
        return rows.map((r) => r.gameId);
      }
    }
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
