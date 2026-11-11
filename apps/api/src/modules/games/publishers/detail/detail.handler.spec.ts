import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import { GetPublisherGamesHandler } from "./detail.handler";

describe("GetPublisherGamesHandler", () => {
  let repo: Record<keyof IGamesRepository, any>;
  let handler: GetPublisherGamesHandler;
  const company = { id: "publisher-id", name: "Studio", slug: "studio", countryCode: "JP", role: "publisher" };

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
    handler = new GetPublisherGamesHandler(repo);
  });

  it("uses the publisher namespace even when a developer has the same slug", async () => {
    repo.findPublicCompanyPage.mockResolvedValue({ company, items: [], total: 0 });
    const result = await handler.handle({ params: { slug: "studio" }, query: {} } as any);
    expect(repo.findPublicCompanyPage).toHaveBeenCalledWith("publisher", "studio", { page: 1, limit: 21 });
    expect(result).toEqual({ company, items: [], total: 0, page: 1, limit: 21, totalPages: 0 });
  });

  it("returns 404 for an unknown publisher", async () => {
    repo.findPublicCompanyPage.mockResolvedValue(null);
    await expect(handler.handle({ params: { slug: "missing" }, query: {} } as any))
      .rejects.toMatchObject({ statusCode: 404, message: "err_page_not_found" });
  });

  it("maps cards and pagination without exposing extra company or game fields", async () => {
    repo.findPublicCompanyPage.mockResolvedValue({
      company: { ...company, createdAt: new Date() }, total: 22,
      items: [{ slug: "game", title: "Game", coverImageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2222.jpg", releaseDate: null,
        criticScore: 82, criticScoreCount: 3, metacriticScore: null, openCriticScore: 86,
        popularityScore: 0, hltbMainHours: "15", hltbMainExtraHours: "30", hltbCompletionistHours: "60", id: "private-id" }],
    });
    const result = await handler.handle({ params: { slug: "studio" }, query: { page: 2, limit: 21 } } as any);
    expect(result).toMatchObject({ company, total: 22, page: 2, limit: 21, totalPages: 2 });
    expect(result.company).not.toHaveProperty("createdAt");
    expect(result.items[0]).toMatchObject({ coverImageUrl: null, criticScore: 82, metacriticScore: null, openCriticScore: null, popularityScore: 0,
      hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null });
    expect(result.items[0]).not.toHaveProperty("id");
  });

  it("keeps the publisher and totals for a page beyond the end", async () => {
    repo.findPublicCompanyPage.mockResolvedValue({ company, items: [], total: 1 });
    const result = await handler.handle({ params: { slug: "studio" }, query: { page: 5 } } as any);
    expect(result).toMatchObject({ company, items: [], total: 1, page: 5, totalPages: 1 });
  });
});
