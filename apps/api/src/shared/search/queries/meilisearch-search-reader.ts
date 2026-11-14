import { reportRuntimeFailure } from "../../application-logs/runtime-failures";
import { inject, injectable } from "tsyringe";
import type { Developer } from "../../../modules/catalog/developers.repository.interface";
import type { Publisher } from "../../../modules/catalog/publishers.repository.interface";
import type { Genre } from "../../../modules/catalog/genres.repository.interface";
import type { Platform } from "../../../modules/catalog/platforms.repository.interface";
import type { Theme } from "../../../modules/catalog/themes.repository.interface";
import type {
  GameCard,
  GameCompanyRole,
  GameWithRelations,
  PublicCompanyMatch,
} from "../../../modules/catalog/games.repository.interface";
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
import { SEARCH_CLIENT, MEILISEARCH_CONFIG, type MeilisearchConfig } from "../search.tokens";
import { isSearchFallbackError, type ISearchClient, type MeilisearchSearchParams } from "../meilisearch.client";
import type { ISearchReader } from "./search-reader.interface";
import type { SearchQuery, SearchResult, PostSearchItem } from "../search.types";
import { SEARCH_INDEXES } from "../search.indexes";
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
// Company candidates per requested result: a few matches may have no games and are dropped.
const COMPANY_CANDIDATE_FACTOR = 3;
const COMPANY_CANDIDATES_MAX = 72;
// Search pages read at most while companies without games leave a group under-filled.
const COMPANY_MAX_PAGES = 3;

/** Dashboard lists: relevance first for typed queries (the `sort` rule follows `attribute`), newest first otherwise. */
const NEWEST_FIRST = ["createdAt:desc"];
const LOOKUP_SEARCH_ON = ["name", "slug"];

type CompanyHit = { id: string; _rankingScore?: number };

@injectable()
export class MeilisearchSearchReader implements ISearchReader {
  private readonly enabled: boolean;
  private searchRetryAt = 0;

  constructor(
    @inject(SEARCH_CLIENT) private readonly client: ISearchClient,
    @inject(MEILISEARCH_CONFIG) config: MeilisearchConfig,
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository,
    @inject(PLATFORMS_REPOSITORY) private readonly platformsRepo: IPlatformsRepository,
    @inject(THEMES_REPOSITORY) private readonly themesRepo: IThemesRepository,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository
  ) {
    this.enabled = config.enabled;
  }

  // --- Public search methods ---

  searchGames(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    return this.runSearch(
      () => this.page<GameDoc, GameWithRelations>(SEARCH_INDEXES.games, query, { sort: NEWEST_FIRST }, gameWithRelationsFromDoc),
      () => this.fallbackGamesSearch(query),
      "games"
    );
  }

  searchPublicGames(query: SearchQuery): Promise<SearchResult<GameCard>> {
    const typed = !!query.q?.trim();
    return this.runSearch(
      () => this.page<GameDoc, GameCard>(SEARCH_INDEXES.games, { ...query, limit: query.limit ?? 24 }, {
        attributesToSearchOn: ["title", "originalTitle"],
        attributesToRetrieve: ["id", "slug", "title", "releaseDate", "criticScore", "criticScoreCount", "popularityScore"],
        // Interest in announced/undated games belongs in the same public catalog.
        // Unscored games carry POPULARITY_UNKNOWN (-1), so they sort after every scored one.
        // Typed queries rank by relevance; the index's last ranking rule is popularityScore:desc.
        ...(typed ? {} : { sort: ["popularityScore:desc", "releaseTimestamp:desc"] }),
      }, gameCardFromDoc),
      () => this.fallbackPublicGamesSearch(query),
      "public games"
    );
  }

  async searchPublicCompanies(role: GameCompanyRole, query: { q: string; limit: number }): Promise<PublicCompanyMatch[]> {
    const q = query.q.trim();
    const limit = query.limit;
    if (!q || limit < 1) return [];
    const perPage = Math.min(limit * COMPANY_CANDIDATE_FACTOR, COMPANY_CANDIDATES_MAX);
    const ranked: Array<{ company: PublicCompanyMatch; order: number; score: number }> = [];
    let order = 0;

    for (let page = 1; page <= COMPANY_MAX_PAGES; page++) {
      // Only the search call runs under the timeout and cooldown; null means it was skipped or failed.
      const hits = await this.runSearch(
        () => this.runCompanyHitsSearch(role, q, page, perPage),
        async () => null,
        `public ${role}s`
      );
      if (hits === null) {
        // Postgres answers in full when search never did; otherwise keep the matches already found.
        if (page === 1) return this.gamesRepo.searchPublicCompanies(role, q, limit);
        break;
      }
      if (!hits.length) break;

      // Search owns relevance; Postgres owns names, slugs, game counts and the "has games" rule.
      const current = await this.gamesRepo.findPublicCompaniesByIds(role, hits.map((hit) => hit.id));
      const byId = new Map(current.map((company) => [company.id, company]));
      for (const hit of hits) {
        const company = byId.get(hit.id);
        if (company) ranked.push({ company, order: order++, score: hit._rankingScore ?? 0 });
      }
      // Companies without games are dropped; read further pages only while the group is under-filled.
      if (ranked.length >= limit || hits.length < perPage) break;
    }

    return ranked
      .sort((a, b) => b.score - a.score || b.company.gameCount - a.company.gameCount || a.order - b.order)
      .slice(0, limit)
      .map(({ company }) => company);
  }

  searchPosts(query: SearchQuery): Promise<SearchResult<PostSearchItem>> {
    return this.runSearch(
      // Title outranks content through the index's searchable attribute order.
      () => this.page<PostDoc, PostSearchItem>(SEARCH_INDEXES.posts, query,
        { attributesToSearchOn: ["title", "content"], sort: ["publishedAt:desc"] }, postFromDoc),
      () => this.fallbackPostsSearch(query),
      "posts"
    );
  }

  searchDevelopers(query: SearchQuery): Promise<SearchResult<Developer>> {
    return this.runSearch(
      () => this.page<DeveloperDoc, Developer>(SEARCH_INDEXES.developers, query, { attributesToSearchOn: LOOKUP_SEARCH_ON, sort: NEWEST_FIRST }, developerFromDoc),
      () => this.fallbackDevelopersSearch(query),
      "developers"
    );
  }

  searchPublishers(query: SearchQuery): Promise<SearchResult<Publisher>> {
    return this.runSearch(
      () => this.page<PublisherDoc, Publisher>(SEARCH_INDEXES.publishers, query, { attributesToSearchOn: LOOKUP_SEARCH_ON, sort: NEWEST_FIRST }, publisherFromDoc),
      () => this.fallbackPublishersSearch(query),
      "publishers"
    );
  }

  searchGenres(query: SearchQuery): Promise<SearchResult<Genre>> {
    return this.runSearch(
      () => this.page<GenreDoc, Genre>(SEARCH_INDEXES.genres, query, { attributesToSearchOn: LOOKUP_SEARCH_ON, sort: NEWEST_FIRST }, genreFromDoc),
      () => this.fallbackGenresSearch(query),
      "genres"
    );
  }

  searchPlatforms(query: SearchQuery): Promise<SearchResult<Platform>> {
    return this.runSearch(
      () => this.page<PlatformDoc, Platform>(SEARCH_INDEXES.platforms, query, { attributesToSearchOn: LOOKUP_SEARCH_ON, sort: NEWEST_FIRST }, platformFromDoc),
      () => this.fallbackPlatformsSearch(query),
      "platforms"
    );
  }

  searchThemes(query: SearchQuery): Promise<SearchResult<Theme>> {
    return this.runSearch(
      () => this.page<ThemeDoc, Theme>(SEARCH_INDEXES.themes, query, { attributesToSearchOn: LOOKUP_SEARCH_ON, sort: NEWEST_FIRST }, themeFromDoc),
      () => this.fallbackThemesSearch(query),
      "themes"
    );
  }

  private async runSearch<T>(
    searchCall: () => Promise<T>,
    fallback: () => Promise<T>,
    entityLabel: string
  ): Promise<T> {
    if (!this.enabled || Date.now() < this.searchRetryAt) {
      return fallback();
    }
    try {
      return await withTimeout(searchCall(), SEARCH_TIMEOUT_MS, `meilisearch.${entityLabel}.search`);
    } catch (err) {
      if (isSearchFallbackError(err)) {
        const now = Date.now();
        if (now >= this.searchRetryAt) {
          this.searchRetryAt = now + SEARCH_COOLDOWN_MS;
          reportRuntimeFailure("search_fallback", `Meilisearch ${entityLabel} search failed. Using Postgres`, err, "warning");
        }
        return fallback();
      }
      throw err;
    }
  }

  // --- Private: search runners ---

  /** One numbered page; an empty `q` is a placeholder (browse) search. */
  private async page<D, T>(
    index: string,
    query: SearchQuery,
    params: MeilisearchSearchParams,
    fromDoc: (doc: D) => T
  ): Promise<SearchResult<T>> {
    const res = await this.client.search<D>(index, {
      q: query.q?.trim() ?? "",
      ...params,
      page: query.page ?? 1,
      hitsPerPage: query.limit ?? 10,
    });
    return {
      items: res.hits.map((hit) => fromDoc(hit)),
      total: res.totalHits ?? 0,
    };
  }

  private async runCompanyHitsSearch(
    role: GameCompanyRole,
    q: string,
    page: number,
    perPage: number
  ): Promise<CompanyHit[]> {
    const index = role === "developer" ? SEARCH_INDEXES.developers : SEARCH_INDEXES.publishers;
    const res = await this.client.search<{ id: string }>(index, {
      q,
      attributesToSearchOn: ["name"],
      attributesToRetrieve: ["id"],
      showRankingScore: true,
      page,
      hitsPerPage: perPage,
    });
    return res.hits;
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
        metacriticScore: null,
        openCriticScore: null,
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
}
