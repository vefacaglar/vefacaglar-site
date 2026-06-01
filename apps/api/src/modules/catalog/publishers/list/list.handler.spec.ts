import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListPublishersHandler } from "./list.handler";
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

describe("ListPublishersHandler", () => {
  let mockReader: Record<keyof ISearchReader, any>;
  let handler: ListPublishersHandler;

  beforeEach(() => {
    mockReader = makeReader();
    handler = new ListPublishersHandler(mockReader as unknown as ISearchReader);
  });

  it("should call searchPublishers with provided query and map countryCode", async () => {
    mockReader.searchPublishers.mockResolvedValue({
      items: [
        {
          id: "p-1",
          name: "CD Projekt",
          slug: "cd-projekt",
          countryCode: "PL",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
      total: 1,
    });

    const mockRequest = {
      query: { page: 2, limit: 5, q: "cd" },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockReader.searchPublishers).toHaveBeenCalledWith({
      q: "cd",
      page: 2,
      limit: 5,
    });
    expect(result.items[0].countryCode).toBe("PL");
    expect(result.totalPages).toBe(1);
  });

  it("should default to page=1 and limit=10", async () => {
    mockReader.searchPublishers.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockReader.searchPublishers).toHaveBeenCalledWith({
      q: undefined,
      page: 1,
      limit: 10,
    });
  });

  it("should map null countryCode and null updatedAt to null", async () => {
    mockReader.searchPublishers.mockResolvedValue({
      items: [
        {
          id: "p-2",
          name: "X",
          slug: "x",
          countryCode: null,
          createdAt: new Date(),
          updatedAt: null,
        },
      ],
      total: 1,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.items[0].countryCode).toBeNull();
    expect(result.items[0].updatedAt).toBeNull();
  });

  it("should compute totalPages with Math.ceil", async () => {
    mockReader.searchPublishers.mockResolvedValue({ items: [], total: 23 });

    const mockRequest = {
      query: { page: 1, limit: 10 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.totalPages).toBe(3);
  });
});
