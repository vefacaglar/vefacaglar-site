import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListPlatformsHandler } from "./list.handler";
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

describe("ListPlatformsHandler", () => {
  let mockReader: Record<keyof ISearchReader, any>;
  let handler: ListPlatformsHandler;

  beforeEach(() => {
    mockReader = makeReader();
    handler = new ListPlatformsHandler(mockReader as unknown as ISearchReader);
  });

  it("should call searchPlatforms with provided query", async () => {
    mockReader.searchPlatforms.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: { page: 2, limit: 5, q: "pc" },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockReader.searchPlatforms).toHaveBeenCalledWith({
      q: "pc",
      page: 2,
      limit: 5,
    });
    expect(result.totalPages).toBe(0);
  });

  it("should default to page=1 and limit=10", async () => {
    mockReader.searchPlatforms.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockReader.searchPlatforms).toHaveBeenCalledWith({
      q: undefined,
      page: 1,
      limit: 10,
    });
  });

  it("should map null updatedAt to null", async () => {
    mockReader.searchPlatforms.mockResolvedValue({
      items: [
        {
          id: "p-1",
          name: "PC",
          slug: "pc",
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
    mockReader.searchPlatforms.mockResolvedValue({ items: [], total: 23 });

    const mockRequest = {
      query: { page: 1, limit: 10 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.totalPages).toBe(3);
  });
});
