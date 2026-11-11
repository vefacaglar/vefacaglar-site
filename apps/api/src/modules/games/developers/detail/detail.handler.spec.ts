import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { GetDeveloperGamesHandler } from "./detail.handler";

describe("GetDeveloperGamesHandler", () => {
  let repo: Record<keyof IGamesRepository, any>;
  let handler: GetDeveloperGamesHandler;
  const company = { id: "developer-id", name: "Studio", slug: "studio", countryCode: null, role: "developer" };

  beforeEach(() => {
    repo = {
      create: vi.fn(), findById: vi.fn(), findBySlug: vi.fn(), list: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findGameIdsByRelation: vi.fn(), findPublicCardsByIds: vi.fn(), listPublic: vi.fn(), findPublicCompanyPage: vi.fn(),
      loadCatalogIndex: vi.fn(), findByIds: vi.fn(), findLookupsByIds: vi.fn(), listPopularitySources: vi.fn(),
      findOwnerRankingSource: vi.fn(), listGameModeCandidates: vi.fn(), writeGameModes: vi.fn(),
      writePopularity: vi.fn(), writeImportPage: vi.fn(),
      linkDeveloper: vi.fn(), unlinkDeveloper: vi.fn(), linkPublisher: vi.fn(), unlinkPublisher: vi.fn(),
      linkGenre: vi.fn(), unlinkGenre: vi.fn(), linkPlatform: vi.fn(), unlinkPlatform: vi.fn(), linkTheme: vi.fn(), unlinkTheme: vi.fn(),
    };
    handler = new GetDeveloperGamesHandler(repo);
  });

  it("resolves the developer namespace and defaults to 21 cards", async () => {
    repo.findPublicCompanyPage.mockResolvedValue({ company, items: [], total: 0 });
    const result = await handler.handle({ params: { slug: "studio" }, query: {} } as any);
    expect(repo.findPublicCompanyPage).toHaveBeenCalledWith("developer", "studio", { page: 1, limit: 21 });
    expect(result).toEqual({ company, items: [], total: 0, page: 1, limit: 21, totalPages: 0 });
  });

  it("returns a localized 404 only when the developer does not exist", async () => {
    repo.findPublicCompanyPage.mockResolvedValue(null);
    await expect(handler.handle({ params: { slug: "missing" }, query: {} } as any))
      .rejects.toMatchObject({ statusCode: 404, message: "err_page_not_found" });
    await expect(handler.handle({ params: { slug: "missing" }, query: {} } as any)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps real totals for an empty page beyond the last page", async () => {
    repo.findPublicCompanyPage.mockResolvedValue({ company, items: [], total: 43 });
    const result = await handler.handle({ params: { slug: "studio" }, query: { page: 99, limit: 20 } } as any);
    expect(repo.findPublicCompanyPage).toHaveBeenCalledWith("developer", "studio", { page: 99, limit: 20 });
    expect(result).toMatchObject({ company, items: [], total: 43, page: 99, limit: 20, totalPages: 3 });
  });

  it("uses the public card projection, preserving order and eligible metrics without administrative fields", async () => {
    repo.findPublicCompanyPage.mockResolvedValue({
      company: { ...company, createdAt: new Date(), privateNotes: "not public" },
      total: 2,
      items: [
        { id: "internal-a", slug: "a", title: "A", coverImageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1111.jpg", releaseDate: "2030-01-01", metacriticScore: 88,
          openCriticScore: 90, criticScore: 95, criticScoreCount: 2, popularityScore: 0.8,
          hltbMainHours: "20.5", hltbMainExtraHours: "0", hltbCompletionistHours: "bad", rawData: "not public" },
        { id: "internal-b", slug: "b", title: "B", coverImageUrl: null, releaseDate: null, metacriticScore: 101,
          openCriticScore: Number.NaN, criticScore: 83, criticScoreCount: 3, popularityScore: -1,
          hltbMainHours: null, hltbMainExtraHours: "35", hltbCompletionistHours: "60" },
      ],
    });
    const result = await handler.handle({ params: { slug: "studio" }, query: {} } as any);
    expect(result.company).toEqual(company);
    expect(result.items.map((game) => game.slug)).toEqual(["a", "b"]);
    expect(result.items[0]).toMatchObject({ coverImageUrl: null, metacriticScore: null, openCriticScore: null, criticScore: null,
      popularityScore: 0.8, hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null });
    expect(result.items[1]).toMatchObject({ metacriticScore: null, openCriticScore: null, criticScore: 83,
      popularityScore: null, hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null });
    expect(result.items[0]).not.toHaveProperty("id");
    expect(result.items[0]).not.toHaveProperty("rawData");
  });
});
