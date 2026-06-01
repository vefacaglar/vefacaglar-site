import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateGameHandler } from "./update.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("UpdateGameHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UpdateGameHandler;

  beforeEach(() => {
    mockCatalog = { updateGame: vi.fn() };
    handler = new UpdateGameHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should pass id and patch to updateGame and map the result", async () => {
    mockCatalog.updateGame.mockResolvedValue({
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
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
      developers: [],
      publishers: [],
      genres: [],
      platforms: [],
      themes: [],
    });

    const mockRequest = {
      params: { id: "g-1" },
      body: {
        title: "The Witcher 3",
        slug: "witcher-3",
        description: "RPG",
        metacriticScore: 93,
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.updateGame).toHaveBeenCalledWith("g-1", {
      title: "The Witcher 3",
      slug: "witcher-3",
      originalTitle: undefined,
      description: "RPG",
      coverImageUrl: undefined,
      releaseDate: undefined,
      metacriticScore: 93,
      openCriticScore: undefined,
      hltbMainHours: undefined,
      hltbMainExtraHours: undefined,
      hltbCompletionistHours: undefined,
    });
    expect(result.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("should propagate catalog errors", async () => {
    mockCatalog.updateGame.mockRejectedValue(new Error("not found"));

    const mockRequest = {
      params: { id: "missing" },
      body: { title: "X" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("not found");
  });
});
