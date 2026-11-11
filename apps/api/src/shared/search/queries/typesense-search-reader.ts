import { reportRuntimeFailure } from "../../application-logs/runtime-failures";
import { inject, injectable } from "tsyringe";
import { Client as TypesenseClient } from "typesense";
import type { Developer } from "../../../modules/catalog/developers.repository.interface";
import type { Publisher } from "../../../modules/catalog/publishers.repository.interface";
import type { Genre } from "../../../modules/catalog/genres.repository.interface";
import type { Platform } from "../../../modules/catalog/platforms.repository.interface";
import type { Theme } from "../../../modules/catalog/themes.repository.interface";
import type { GameCard, GameWithRelations } from "../../../modules/catalog/games.repository.interface";
import {
  DEVELOPERS_REPOSITORY,
  PUBLISHERS_REPOSITORY,
  GENRES_REPOSITORY,
  PLATFORMS_REPOSITORY,
  THEMES_REPOSITORY,
  GAMES_REPOSITORY,
} from "../../../modules/catalog/catalog.tokens";
import { POSTS_REPOSITORY } from "../../../modules/posts/posts.tokens";
import type { IDevelopersRepository } from "../../../modules/catalog/developers.repository.interface";
import type { IPublishersRepository } from "../../../modules/catalog/publishers.repository.interface";
import type { IGenresRepository } from "../../../modules/catalog/genres.repository.interface";
import type { IPlatformsRepository } from "../../../modules/catalog/platforms.repository.interface";
import type { IThemesRepository } from "../../../modules/catalog/themes.repository.interface";
import type { IGamesRepository } from "../../../modules/catalog/games.repository.interface";
import type { IPostsRepository } from "../../../modules/posts/posts.repository.interface";
import { TYPESENSE_CLIENT, TYPESENSE_CONFIG, type TypesenseConfig } from "../search.tokens";
import type { ISearchReader } from "./search-reader.interface";
import type { SearchQuery, SearchResult, PostSearchItem } from "../search.types";
import { SEARCH_COLLECTIONS } from "../collections";
import { withTimeout } from "../with-timeout";
import { gameCardFromDoc, gameWithRelationsFromDoc, type GameDoc } from "../mappers/game.mapper";
import { postFromDoc, type PostDoc } from "../mappers/post.mapper";
import {
  developerFromDoc,
  publisherFromDoc,
  genreFromDoc,
  platformFromDoc,
  themeFromDoc,
  type DeveloperDoc,
  type PublisherDoc,
  type GenreDoc,
  type PlatformDoc,
  type ThemeDoc,
} from "../mappers/lookup.mapper";

const SEARCH_TIMEOUT_MS = 3000;
const SEARCH_COOLDOWN_MS = 30_000;

@injectable()
export class TypesenseSearchReader implements ISearchReader {
  private readonly enabled: boolean;
  private typesenseRetryAt = 0;

  constructor(
    @inject(TYPESENSE_CLIENT) private readonly typesense: TypesenseClient,
    @inject(TYPESENSE_CONFIG) typesenseConfig: TypesenseConfig,
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository,
    @inject(PLATFORMS_REPOSITORY) private readonly platformsRepo: IPlatformsRepository,
    @inject(THEMES_REPOSITORY) private readonly themesRepo: IThemesRepository,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository
  ) {
    this.enabled = typesenseConfig.enabled;
  }

  // --- Public search methods ---

  searchGames(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    return this.runSearch(
      () => this.runGamesSearch(query),
      () => this.fallbackGamesSearch(query),
      "games"
    );
  }

  searchPublicGames(query: SearchQuery): Promise<SearchResult<GameCard>> {
    return this.runSearch(
      () => this.runPublicGamesSearch(query),
      () => this.fallbackPublicGamesSearch(query),
      "public games"
    );
  }

  searchPosts(query: SearchQuery): Promise<SearchResult<PostSearchItem>> {
    return this.runSearch(
      () => this.runPostsSearch(query),
      () => this.fallbackPostsSearch(query),
      "posts"
    );
  }

  searchDevelopers(query: SearchQuery): Promise<SearchResult<Developer>> {
    return this.runSearch(
      () => this.runDevelopersSearch(query),
      () => this.fallbackDevelopersSearch(query),
      "developers"
    );
  }

  searchPublishers(query: SearchQuery): Promise<SearchResult<Publisher>> {
    return this.runSearch(
      () => this.runPublishersSearch(query),
      () => this.fallbackPublishersSearch(query),
      "publishers"
    );
  }

  searchGenres(query: SearchQuery): Promise<SearchResult<Genre>> {
    return this.runSearch(
      () => this.runGenresSearch(query),
      () => this.fallbackGenresSearch(query),
      "genres"
    );
  }

  searchPlatforms(query: SearchQuery): Promise<SearchResult<Platform>> {
    return this.runSearch(
      () => this.runPlatformsSearch(query),
      () => this.fallbackPlatformsSearch(query),
      "platforms"
    );
  }

  searchThemes(query: SearchQuery): Promise<SearchResult<Theme>> {
    return this.runSearch(
      () => this.runThemesSearch(query),
      () => this.fallbackThemesSearch(query),
      "themes"
    );
  }

  private async runSearch<T>(
    typesenseCall: () => Promise<T>,
    fallback: () => Promise<T>,
    entityLabel: string
  ): Promise<T> {
    if (!this.enabled || Date.now() < this.typesenseRetryAt) {
      return fallback();
    }
    try {
      return await withTimeout(typesenseCall(), SEARCH_TIMEOUT_MS, `typesense.${entityLabel}.search`);
    } catch (err) {
      if (this.isFallbackEligibleError(err)) {
        const now = Date.now();
        if (now >= this.typesenseRetryAt) {
          this.typesenseRetryAt = now + SEARCH_COOLDOWN_MS;
          reportRuntimeFailure("search_fallback", `Typesense ${entityLabel} search failed. Using Postgres`, err, "warning");
        }
        return fallback();
      }
      throw err;
    }
  }

  // --- Private: search runners ---

  private async runGamesSearch(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    const res = await this.typesense.collections(SEARCH_COLLECTIONS.games).documents().search({
      q: query.q?.trim() || "*",
      query_by: "title,originalTitle,description,slug,developerNames,publisherNames,genreNames,platformNames,themeNames",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: GameDoc }>;
    return {
      items: hits.map((h) => gameWithRelationsFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runPublicGamesSearch(query: SearchQuery): Promise<SearchResult<GameCard>> {
    const q = query.q?.trim();
    const res = await this.typesense.collections(SEARCH_COLLECTIONS.games).documents().search({
      q: q || "*",
      query_by: "title,originalTitle",
      // Interest in announced/undated games belongs in the same public catalog.
      // Unscored games carry POPULARITY_UNKNOWN (-1), so they sort after every scored one.
      ...(q
        ? { sort_by: "_text_match:desc,popularityScore:desc" }
        : {
            sort_by: "popularityScore:desc,releaseTimestamp:desc",
          }),
      include_fields: "id,slug,title,releaseDate,metacriticScore,openCriticScore,criticScore,criticScoreCount,popularityScore",
      page: query.page ?? 1,
      per_page: query.limit ?? 24,
    });
    const hits = (res.hits ?? []) as Array<{ document: GameDoc }>;
    return {
      items: hits.map((h) => gameCardFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runPostsSearch(query: SearchQuery): Promise<SearchResult<PostSearchItem>> {
    const res = await this.typesense.collections(SEARCH_COLLECTIONS.posts).documents().search({
      q: query.q?.trim() || "*",
      query_by: "title,content",
      query_by_weights: "4,1",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: PostDoc }>;
    return {
      items: hits.map((h) => postFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runDevelopersSearch(query: SearchQuery): Promise<SearchResult<Developer>> {
    const res = await this.typesense.collections(SEARCH_COLLECTIONS.developers).documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: DeveloperDoc }>;
    return {
      items: hits.map((h) => developerFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runPublishersSearch(query: SearchQuery): Promise<SearchResult<Publisher>> {
    const res = await this.typesense.collections(SEARCH_COLLECTIONS.publishers).documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: PublisherDoc }>;
    return {
      items: hits.map((h) => publisherFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runGenresSearch(query: SearchQuery): Promise<SearchResult<Genre>> {
    const res = await this.typesense.collections(SEARCH_COLLECTIONS.genres).documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: GenreDoc }>;
    return {
      items: hits.map((h) => genreFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runPlatformsSearch(query: SearchQuery): Promise<SearchResult<Platform>> {
    const res = await this.typesense.collections(SEARCH_COLLECTIONS.platforms).documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: PlatformDoc }>;
    return {
      items: hits.map((h) => platformFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runThemesSearch(query: SearchQuery): Promise<SearchResult<Theme>> {
    const res = await this.typesense.collections(SEARCH_COLLECTIONS.themes).documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: ThemeDoc }>;
    return {
      items: hits.map((h) => themeFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  // --- Private: Postgres fallbacks ---

  private fallbackGamesSearch(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    return this.gamesRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private async fallbackPublicGamesSearch(query: SearchQuery): Promise<SearchResult<GameCard>> {
    const result = await this.gamesRepo.listPublic({ q: query.q, page: query.page ?? 1, limit: query.limit ?? 24 });
    return {
      total: result.total,
      items: result.items.map((item) => ({
        ...item,
        coverImageUrl: null,
        hltbMainHours: null,
        hltbMainExtraHours: null,
        hltbCompletionistHours: null,
      })),
    };
  }

  private fallbackPostsSearch(query: SearchQuery): Promise<SearchResult<PostSearchItem>> {
    return this.postsRepo.listWithAuthor({ status: "published", q: query.q, page: query.page, limit: query.limit }).then(
      ({ items, total }) => ({
        items: items.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          excerpt: row.excerpt ?? null,
          status: "published" as const,
          coverImageUrl: row.coverImageUrl ?? null,
          seoTitle: row.seoTitle ?? null,
          seoDescription: row.seoDescription ?? null,
          publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          author: row.authorUsername && row.authorDisplayName
            ? { username: row.authorUsername, displayName: row.authorDisplayName }
            : null,
        })),
        total,
      })
    );
  }

  private fallbackDevelopersSearch(query: SearchQuery): Promise<SearchResult<Developer>> {
    return this.developersRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackPublishersSearch(query: SearchQuery): Promise<SearchResult<Publisher>> {
    return this.publishersRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackGenresSearch(query: SearchQuery): Promise<SearchResult<Genre>> {
    return this.genresRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackPlatformsSearch(query: SearchQuery): Promise<SearchResult<Platform>> {
    return this.platformsRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackThemesSearch(query: SearchQuery): Promise<SearchResult<Theme>> {
    return this.themesRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private isFallbackEligibleError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    if (msg.includes("timed out")) return true;
    if (msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("etimedout") || msg.includes("network")) return true;
    if (msg.includes("collection") && msg.includes("not found")) return true;
    const status = (err as { httpStatus?: number }).httpStatus;
    // 404 means the collection itself is missing (e.g. the index host restarted
    // with an empty disk) — the client reports it as a generic "Not found."
    // without naming the collection, so match on status too.
    if (status === 404) return true;
    // The collection predates a field the query filters or sorts on; it is
    // fixed by a `search.reindex` job with `drop: true` (docs/jobs-worker.md),
    // and Postgres can answer meanwhile.
    if (status === 400 && msg.includes("could not find a field")) return true;
    if (typeof status === "number" && status >= 500) return true;
    return false;
  }
}
