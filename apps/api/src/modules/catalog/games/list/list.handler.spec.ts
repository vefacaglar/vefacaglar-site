import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListGamesHandler } from "./list.handler";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import { FastifyRequest } from "fastify";

function makeReader(): Record<keyof ISearchReader, any> {
  return {
    searchGames: vi.fn(),
    searchDevelopers: vi.fn(),
    searchPublishers: vi.fn(),
    searchGenres: vi.fn(),
    searchPlatforms: vi.fn(),
    searchThemes: vi.fn(),
  };
}

describe("ListGamesHandler", () => {
  let mockReader: Record<keyof ISearchReader, any>;
  let handler: ListGamesHandler;

  beforeEach(() => {
    mockReader = makeReader();
    handler = new ListGamesHandler(mockReader as unknown as ISearchReader);
  });

  it("should call searchGames with provided query and map full relations", async () => {
    mockReader.searchGames.mockResolvedValue({
      items: [
        {
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
          developers: [{ id: "d-1", name: "CDPR", slug: "cdpr" }],
          publishers: [{ id: "p-1", name: "CDP", slug: "cdp" }],
          genres: [{ id: "g-2", name: "RPG", slug: "rpg" }],
          platforms: [{ id: "pl-1", name: "PC", slug: "pc" }],
          themes: [{ id: "t-1", name: "Dark Fantasy", slug: "dark-fantasy" }],
        },
      ],
      total: 1,
    });

    const mockRequest = {
      query: { page: 2, limit: 5, q: "witcher" },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockReader.searchGames).toHaveBeenCalledWith({
      q: "witcher",
      page: 2,
      limit: 5,
    });
    expect(result.items[0].developers).toEqual([{ id: "d-1", name: "CDPR", slug: "cdpr" }]);
    expect(result.items[0].publishers).toEqual([{ id: "p-1", name: "CDP", slug: "cdp" }]);
    expect(result.items[0].genres).toEqual([{ id: "g-2", name: "RPG", slug: "rpg" }]);
    expect(result.items[0].platforms).toEqual([{ id: "pl-1", name: "PC", slug: "pc" }]);
    expect(result.items[0].themes).toEqual([{ id: "t-1", name: "Dark Fantasy", slug: "dark-fantasy" }]);
    expect(result.totalPages).toBe(1);
  });

  it("should default to page=1 and limit=10", async () => {
    mockReader.searchGames.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockReader.searchGames).toHaveBeenCalledWith({
      q: undefined,
      page: 1,
      limit: 10,
    });
  });

  it("should map empty relation arrays to empty arrays", async () => {
    mockReader.searchGames.mockResolvedValue({
      items: [
        {
          id: "g-2",
          slug: "x",
          title: "X",
          originalTitle: null,
          description: null,
          coverImageUrl: null,
          releaseDate: null,
          metacriticScore: null,
          openCriticScore: null,
          hltbMainHours: null,
          hltbMainExtraHours: null,
          hltbCompletionistHours: null,
          createdAt: new Date(),
          updatedAt: null,
          developers: [],
          publishers: [],
          genres: [],
          platforms: [],
          themes: [],
        },
      ],
      total: 1,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.items[0].developers).toEqual([]);
    expect(result.items[0].updatedAt).toBeNull();
  });

  it("should compute totalPages with Math.ceil", async () => {
    mockReader.searchGames.mockResolvedValue({ items: [], total: 25 });

    const mockRequest = {
      query: { page: 1, limit: 10 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.totalPages).toBe(3);
  });
});
