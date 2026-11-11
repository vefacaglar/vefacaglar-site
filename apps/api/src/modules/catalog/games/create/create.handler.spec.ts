import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateGameHandler } from "./create.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("CreateGameHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: CreateGameHandler;

  beforeEach(() => {
    mockCatalog = { createGame: vi.fn() };
    handler = new CreateGameHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should split fields and relations, call createGame, and map the result", async () => {
    mockCatalog.createGame.mockResolvedValue({
      id: "g-1",
      slug: "witcher-3",
      title: "The Witcher 3",
      originalTitle: null,
      description: "RPG",
      coverImageUrl: null,
      releaseDate: "2015-05-19",
      metacriticScore: 93,
      openCriticScore: 92,
      hltbMainHours: "50",
      hltbMainExtraHours: "100",
      hltbCompletionistHours: "170",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
      developers: [{ id: "d-1", name: "CDPR", slug: "cdpr" }],
      publishers: [],
      genres: [{ id: "g-2", name: "RPG", slug: "rpg" }],
      platforms: [],
      themes: [],
    });

    const mockRequest = {
      body: {
        title: "The Witcher 3",
        slug: "witcher-3",
        originalTitle: null,
        description: "RPG",
        coverImageUrl: null,
        releaseDate: "2015-05-19",
        metacriticScore: 93,
        openCriticScore: 92,
        hltbMainHours: "50",
        hltbMainExtraHours: "100",
        hltbCompletionistHours: "170",
        developerIds: ["d-1"],
        publisherIds: [],
        genreIds: ["g-2"],
        platformIds: [],
        themeIds: [],
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.createGame).toHaveBeenCalledWith(
      {
        title: "The Witcher 3",
        slug: "witcher-3",
        originalTitle: null,
        description: "RPG",
        coverImageUrl: null,
        releaseDate: "2015-05-19",
        metacriticScore: 93,
        openCriticScore: 92,
        hltbMainHours: "50",
        hltbMainExtraHours: "100",
        hltbCompletionistHours: "170",
      },
      {
        developerIds: ["d-1"],
        publisherIds: [],
        genreIds: ["g-2"],
        platformIds: [],
        themeIds: [],
      }
    );

    expect(result.id).toBe("g-1");
    expect(result.developers).toEqual([{ id: "d-1", name: "CDPR", slug: "cdpr" }]);
    expect(result.genres).toEqual([{ id: "g-2", name: "RPG", slug: "rpg" }]);
  });

  it("allows omitting optional duration fields when creating a game", async () => {
    mockCatalog.createGame.mockResolvedValue({
      id: "g-2",
      slug: "celeste",
      title: "Celeste",
      originalTitle: null,
      description: null,
      coverImageUrl: null,
      releaseDate: null,
      metacriticScore: null,
      openCriticScore: null,
      hltbMainHours: null,
      hltbMainExtraHours: null,
      hltbCompletionistHours: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
      developers: [],
      publishers: [],
      genres: [],
      platforms: [],
      themes: [],
    });

    const result = await handler.handle({
      body: { title: "Celeste", slug: "celeste" },
    } as unknown as FastifyRequest<{ Body: any }>);

    expect(mockCatalog.createGame).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Celeste",
        slug: "celeste",
        hltbMainHours: undefined,
        hltbMainExtraHours: undefined,
        hltbCompletionistHours: undefined,
      }),
      expect.any(Object)
    );
    expect(result.hltbMainHours).toBeNull();
    expect(result.hltbMainExtraHours).toBeNull();
    expect(result.hltbCompletionistHours).toBeNull();
  });

  it("should propagate catalog errors", async () => {
    mockCatalog.createGame.mockRejectedValue(new Error("db constraint"));

    const mockRequest = {
      body: { title: "X", slug: "x" },
    } as unknown as FastifyRequest<{ Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("db constraint");
  });
});
