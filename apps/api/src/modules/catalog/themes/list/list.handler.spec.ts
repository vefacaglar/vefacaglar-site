import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListThemesHandler } from "./list.handler";
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

describe("ListThemesHandler", () => {
  let mockReader: Record<keyof ISearchReader, any>;
  let handler: ListThemesHandler;

  beforeEach(() => {
    mockReader = makeReader();
    handler = new ListThemesHandler(mockReader as unknown as ISearchReader);
  });

  it("should call searchThemes with provided query", async () => {
    mockReader.searchThemes.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: { page: 2, limit: 5, q: "dark" },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockReader.searchThemes).toHaveBeenCalledWith({
      q: "dark",
      page: 2,
      limit: 5,
    });
    expect(result.totalPages).toBe(0);
  });

  it("should default to page=1 and limit=10", async () => {
    mockReader.searchThemes.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockReader.searchThemes).toHaveBeenCalledWith({
      q: undefined,
      page: 1,
      limit: 10,
    });
  });

  it("should map null updatedAt to null", async () => {
    mockReader.searchThemes.mockResolvedValue({
      items: [
        {
          id: "t-1",
          name: "Dark Fantasy",
          slug: "dark-fantasy",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: null,
        },
      ],
      total: 1,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.items[0].updatedAt).toBeNull();
  });

  it("should compute totalPages with Math.ceil", async () => {
    mockReader.searchThemes.mockResolvedValue({ items: [], total: 23 });

    const mockRequest = {
      query: { page: 1, limit: 10 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.totalPages).toBe(3);
  });
});
