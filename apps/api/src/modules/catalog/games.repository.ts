import {
  games,
  gameIgdbCompletionTimes,
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
  gameWikipediaInterest,
  gameWikipediaProviderState,
  catalogImportState,
} from "@vefacaglar/db";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, lt, gt, or, sql, type SQL, getTableColumns } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type {
  CatalogImportWrite,
  CatalogImportWriteResult,
  CatalogIndex,
  CatalogLookupKind,
  CatalogLookupRow,
  GameCard,
  GameCompanyRole,
  PublicGameCompanyPage,
  PublicCompanyMatch,
  PublicGameSuggestion,
  IGamesRepository,
  Game,
  GameWikipediaObservation,
  NewGame,
  GameWithRelations,
  PopularitySource,
  PopularityWrite,
} from "./games.repository.interface";
import { POPULARITY_MAX_AGE_MS } from "./popularity/popularity-score";
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

// Expire each score from its actual source observations, including when jobs stop running.
const CURRENT_POPULARITY_SCORE = sql<number | null>`case
  when ${games.popularityUpdatedAt} >= now() - ${POPULARITY_MAX_AGE_MS} * interval '1 millisecond'
  then ${games.popularityScore} else null end`;

const PUBLIC_CARD_FIELDS = {
  id: games.id,
  slug: games.slug,
  title: games.title,
  coverImageUrl: games.coverImageUrl,
  releaseDate: games.releaseDate,
  metacriticScore: games.metacriticScore,
  openCriticScore: games.openCriticScore,
  criticScore: games.criticScore,
  criticScoreCount: games.criticScoreCount,
  popularityScore: CURRENT_POPULARITY_SCORE,
  completionTimes: {
    // Keep the non-null joined key first so partial metric rows remain hydrated.
    igdbId: gameIgdbCompletionTimes.igdbId,
    hastilySeconds: gameIgdbCompletionTimes.hastilySeconds,
    normallySeconds: gameIgdbCompletionTimes.normallySeconds,
    completelySeconds: gameIgdbCompletionTimes.completelySeconds,
    sampleCount: gameIgdbCompletionTimes.sampleCount,
    sourceUpdatedAt: gameIgdbCompletionTimes.sourceUpdatedAt,
  },
  hltbMainHours: games.hltbMainHours,
  hltbMainExtraHours: games.hltbMainExtraHours,
  hltbCompletionistHours: games.hltbCompletionistHours,
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
      .select({ game: getTableColumns(games), completionTimes: PUBLIC_CARD_FIELDS.completionTimes })
      .from(games)
      .leftJoin(gameIgdbCompletionTimes, eq(games.igdbId, gameIgdbCompletionTimes.igdbId))
      .where(eq(games.slug, slug)).limit(1);
    if (!row) return null;
    return { ...await this.getGameWithRelations(row.game), completionTimes: row.completionTimes };
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
    return this.listPublicCards(filter);
  }

  async findPublicCompanyPage(
    role: GameCompanyRole,
    slug: string,
    filter: { page: number; limit: number },
  ): Promise<PublicGameCompanyPage | null> {
    const db = this.dbProvider.client;
    const rows = role === "developer"
      ? await db.select({ id: developers.id, name: developers.name, slug: developers.slug, countryCode: developers.countryCode })
        .from(developers).where(eq(developers.slug, slug)).limit(1)
      : await db.select({ id: publishers.id, name: publishers.name, slug: publishers.slug, countryCode: publishers.countryCode })
        .from(publishers).where(eq(publishers.slug, slug)).limit(1);
    const company = rows[0];
    if (!company) return null;

    const result = await this.listPublicCards(filter, { role, id: company.id });
    return { company: { ...company, role }, ...result };
  }

  private async listPublicCards(
    filter: { page: number; limit: number; q?: string },
    company?: { role: GameCompanyRole; id: string },
  ): Promise<{ items: GameCard[]; total: number }> {
    const db = this.dbProvider.client;
    const q = filter.q?.trim();
    // Escape LIKE wildcards so a search for "100%" matches literally.
    const pattern = q?.replace(/[\\%_]/g, (c) => `\\${c}`);
    // Current interest can include announced games and games without a release date.
    const companyMatch = company?.role === "developer"
      ? sql`exists (select 1 from ${gameDevelopers} where ${gameDevelopers.gameId} = ${games.id} and ${gameDevelopers.developerId} = ${company.id})`
      : company?.role === "publisher"
        ? sql`exists (select 1 from ${gamePublishers} where ${gamePublishers.gameId} = ${games.id} and ${gamePublishers.publisherId} = ${company.id})`
        : undefined;
    const whereExpr = and(pattern ? ilike(games.title, `%${pattern}%`) : undefined, companyMatch);
    // Current interest includes the bounded single-player preference in its stored score.
    const popularOrder = [
      sql`${CURRENT_POPULARITY_SCORE} desc nulls last`,
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
        .select(PUBLIC_CARD_FIELDS)
        .from(games)
        .leftJoin(gameIgdbCompletionTimes, eq(games.igdbId, gameIgdbCompletionTimes.igdbId))
        .where(whereExpr)
        .orderBy(...order)
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit),
    ]);
    return { items: rows, total: Number(countResult[0]?.count || 0) };
  }

  async findPublicCardsByIds(ids: string[]): Promise<GameCard[]> {
    const validIds = [...new Set(ids.filter((id) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)))].slice(0, 48);
    if (!validIds.length) return [];
    return this.dbProvider.client.select(PUBLIC_CARD_FIELDS).from(games)
      .leftJoin(gameIgdbCompletionTimes, eq(games.igdbId, gameIgdbCompletionTimes.igdbId))
      .where(inArray(games.id, validIds));
  }

  /** Companies of one role joined to their game links: the inner join keeps only companies with games. */
  private publicCompaniesQuery(role: GameCompanyRole, where: SQL | undefined) {
    const table = role === "developer" ? developers : publishers;
    const link = role === "developer"
      ? { table: gameDevelopers, companyId: gameDevelopers.developerId, gameId: gameDevelopers.gameId }
      : { table: gamePublishers, companyId: gamePublishers.publisherId, gameId: gamePublishers.gameId };
    // The link table's company index serves both the join and the count.
    const gameCount = sql<number>`count(${link.gameId})::int`;
    const query = this.dbProvider.client
      .select({ id: table.id, name: table.name, slug: table.slug, gameCount })
      .from(table)
      .innerJoin(link.table, eq(link.companyId, table.id))
      .where(where)
      .groupBy(table.id, table.name, table.slug);
    return { query, table, gameCount };
  }

  async findPublicCompaniesByIds(role: GameCompanyRole, ids: string[]): Promise<PublicCompanyMatch[]> {
    const validIds = [...new Set(ids.filter((id) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)))].slice(0, 100);
    if (!validIds.length) return [];
    const table = role === "developer" ? developers : publishers;
    const rows = await this.publicCompaniesQuery(role, inArray(table.id, validIds)).query;
    return rows.map((row) => ({ ...row, gameCount: Number(row.gameCount) }));
  }

  async searchPublicCompanies(role: GameCompanyRole, q: string, limit: number): Promise<PublicCompanyMatch[]> {
    const term = q.trim();
    if (!term || limit < 1) return [];
    const pattern = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    const lookup = role === "developer" ? developers : publishers;
    // Word-prefix matching, close to Meilisearch's prefix search: "dog" finds "Naughty Dog", not "Bulldog".
    const { query, table, gameCount } = this.publicCompaniesQuery(
      role,
      or(ilike(lookup.name, `${pattern}%`), ilike(lookup.name, `% ${pattern}%`)),
    );
    const rows = await query
      .orderBy(
        asc(sql`case when lower(${table.name}) = lower(${term}) then 0 when ${table.name} ilike ${`${pattern}%`} then 1 else 2 end`),
        desc(gameCount),
        asc(table.name),
        asc(table.id),
      )
      .limit(limit);
    return rows.map((row) => ({ ...row, gameCount: Number(row.gameCount) }));
  }

  async findPublicSuggestionsByIds(ids: string[]): Promise<PublicGameSuggestion[]> {
    const validIds = [...new Set(ids.filter((id) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)))].slice(0, 48);
    if (!validIds.length) return [];
    const db = this.dbProvider.client;
    // A join query renders qualified column names, so the correlation to the outer games row stays unambiguous.
    const firstDeveloper = db
      .select({ name: developers.name })
      .from(gameDevelopers)
      .innerJoin(developers, eq(gameDevelopers.developerId, developers.id))
      .where(eq(gameDevelopers.gameId, games.id))
      .orderBy(asc(developers.name))
      .limit(1);
    return db
      .select({
        id: games.id,
        slug: games.slug,
        title: games.title,
        releaseDate: games.releaseDate,
        developerName: sql<string | null>`(${firstDeveloper})`,
      })
      .from(games)
      .where(inArray(games.id, validIds));
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
    const validIds = [...new Set(ids.filter((id) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)))];
    if (validIds.length === 0) return [];
    const rows = await this.dbProvider.client.select().from(games).where(inArray(games.id, validIds));
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
      })
      .from(games)
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

  async findWikipediaInterest(gameIds: string[]): Promise<GameWikipediaObservation[]> {
    if (gameIds.length === 0) return [];
    if (gameIds.length > 450) throw new Error("Game audience lookup exceeds its bounded cohort");
    return this.dbProvider.client.select().from(gameWikipediaInterest).where(inArray(gameWikipediaInterest.gameId, gameIds));
  }

  async writeWikipediaInterest(observations: GameWikipediaObservation[]): Promise<void> {
    if (observations.length === 0) return;
    await this.dbProvider.transaction(async () => {
      await this.dbProvider.client.insert(gameWikipediaInterest).values(observations).onConflictDoUpdate({
        target: gameWikipediaInterest.gameId,
        set: { article: sql`excluded.article`, sourceDate: sql`excluded.source_date`, currentViews: sql`excluded.current_views`,
          baselineViews: sql`excluded.baseline_views`, fetchedAt: sql`excluded.fetched_at` },
        setWhere: sql`excluded.source_date >= ${gameWikipediaInterest.sourceDate}`,
      });
    });
  }

  async getWikipediaInterestCooldown(): Promise<Date | null> {
    const [row] = await this.dbProvider.client.select().from(gameWikipediaProviderState).where(eq(gameWikipediaProviderState.id, "wikipedia"));
    return row?.cooldownUntil ?? null;
  }

  async setWikipediaInterestCooldown(until: Date): Promise<void> {
    await this.dbProvider.client.insert(gameWikipediaProviderState).values({ id: "wikipedia", cooldownUntil: until }).onConflictDoUpdate({
      target: gameWikipediaProviderState.id, set: { cooldownUntil: sql`greatest(${gameWikipediaProviderState.cooldownUntil}, excluded.cooldown_until)` },
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

      // Interest and recommendation scores commit together, with bounded bulk statements.
      const recommendationById = new Map(write.recommendationScores.map((score) => [score.id, score.score]));
      const sourceDateById = new Map(write.sourceDates.map((source) => [source.id, source.calculatedAt?.toISOString() ?? null]));
      for (const chunk of chunks(write.scores)) {
        const values = sql.join(
          chunk.map((s) => sql`(${s.id}::uuid, ${s.score}::double precision, ${recommendationById.get(s.id) ?? null}::double precision, ${sourceDateById.get(s.id) ?? null}::timestamptz)`),
          sql`, `
        );
        await db.execute(sql`
          update ${games}
          set popularity_score = v.score, popularity_updated_at = v.source_date, popularity_version = ${write.rankingVersion},
              recommendation_score = v.recommendation_score, recommendation_version = ${write.recommendationVersion},
              recommendation_updated_at = ${write.updatedAt.toISOString()}::timestamptz
          from (values ${values}) as v(id, score, recommendation_score, source_date)
          where ${games.id} = v.id
        `);
      }
    });
  }

  async readImportCursor(): Promise<number> {
    const [state] = await this.dbProvider.client.select({ lastId: catalogImportState.lastId })
      .from(catalogImportState).where(eq(catalogImportState.id, "igdb"));
    return state?.lastId ?? 0;
  }

  async writeImportPage(write: CatalogImportWrite): Promise<CatalogImportWriteResult> {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;

      if (write.crawlProgress) {
        const { afterId, lastId } = write.crawlProgress;
        if (!Number.isSafeInteger(afterId) || !Number.isSafeInteger(lastId) || afterId < 0 || lastId <= afterId) {
          throw new Error("Invalid catalog crawl progress");
        }
        await db.insert(catalogImportState).values({ id: "igdb" }).onConflictDoNothing();
        const [state] = await db.select().from(catalogImportState)
          .where(eq(catalogImportState.id, "igdb")).for("update");
        if (state.lastId !== afterId) throw new Error("Catalog cursor changed; retry from committed progress");
      }

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

      if (write.crawlProgress) {
        await db.update(catalogImportState).set({ lastId: write.crawlProgress.lastId, updatedAt: new Date() })
          .where(eq(catalogImportState.id, "igdb"));
      }
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
