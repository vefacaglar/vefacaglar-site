import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetGameHandler } from "./detail.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("GetGameHandler", () => {
  let mockCatalogService: Record<string, any>;
  let handler: GetGameHandler;

  beforeEach(() => {
    mockCatalogService = {
      getGameById: vi.fn(),
    };

    handler = new GetGameHandler(mockCatalogService as unknown as GameCatalogService);
  });

  it("should successfully retrieve game detail and map all nested lookup categories", async () => {
    const mockGame = {
      id: "game-123",
      slug: "witcher-3",
      title: "The Witcher 3: Wild Hunt",
      originalTitle: "Wiedźmin 3: Dziki Gon",
      description: "An epic open world RPG.",
      coverImageUrl: "https://example.com/witcher3.jpg",
      releaseDate: "2015-05-19",
      metacriticScore: 93,
      openCriticScore: 92,
      hltbMainHours: 50,
      hltbMainExtraHours: 100,
      hltbCompletionistHours: 170,
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      developers: [{ id: "dev-1", name: "CD Projekt Red", slug: "cd-projekt-red" }],
      publishers: [{ id: "pub-1", name: "CD Projekt", slug: "cd-projekt" }],
      genres: [{ id: "genre-1", name: "RPG", slug: "rpg" }],
      platforms: [{ id: "plat-1", name: "PC", slug: "pc" }],
      themes: [{ id: "theme-1", name: "Dark Fantasy", slug: "dark-fantasy" }],
    };

    mockCatalogService.getGameById.mockResolvedValue(mockGame);

    const mockRequest = {
      params: { id: "game-123" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalogService.getGameById).toHaveBeenCalledWith("game-123");
    expect(result).toEqual({
      id: "game-123",
      slug: "witcher-3",
      title: "The Witcher 3: Wild Hunt",
      originalTitle: "Wiedźmin 3: Dziki Gon",
      description: "An epic open world RPG.",
      coverImageUrl: "https://example.com/witcher3.jpg",
      releaseDate: "2015-05-19",
      metacriticScore: 93,
      openCriticScore: 92,
      hltbMainHours: 50,
      hltbMainExtraHours: 100,
      hltbCompletionistHours: 170,
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T12:00:00.000Z",
      developers: [{ id: "dev-1", name: "CD Projekt Red", slug: "cd-projekt-red" }],
      publishers: [{ id: "pub-1", name: "CD Projekt", slug: "cd-projekt" }],
      genres: [{ id: "genre-1", name: "RPG", slug: "rpg" }],
      platforms: [{ id: "plat-1", name: "PC", slug: "pc" }],
      themes: [{ id: "theme-1", name: "Dark Fantasy", slug: "dark-fantasy" }],
    });
  });

  it("should return null-mapped updatedAt field if it is missing", async () => {
    const mockGameNoUpdate = {
      id: "game-456",
      slug: "simple-game",
      title: "Simple",
      originalTitle: null,
      description: "Description",
      coverImageUrl: null,
      releaseDate: null,
      metacriticScore: null,
      openCriticScore: null,
      hltbMainHours: null,
      hltbMainExtraHours: null,
      hltbCompletionistHours: null,
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: null,
      developers: [],
      publishers: [],
      genres: [],
      platforms: [],
      themes: [],
    };

    mockCatalogService.getGameById.mockResolvedValue(mockGameNoUpdate);

    const mockRequest = {
      params: { id: "game-456" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(result.updatedAt).toBeNull();
    expect(result.originalTitle).toBeNull();
  });
});
