import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListDevelopersHandler } from "./list.handler";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import { FastifyRequest } from "fastify";

describe("ListDevelopersHandler", () => {
  let mockSearchReader: Record<keyof ISearchReader, any>;
  let handler: ListDevelopersHandler;

  beforeEach(() => {
    mockSearchReader = {
      searchGames: vi.fn(),
      searchDevelopers: vi.fn(),
      searchPublishers: vi.fn(),
      searchGenres: vi.fn(),
      searchPlatforms: vi.fn(),
      searchThemes: vi.fn(),
    };

    handler = new ListDevelopersHandler(mockSearchReader as unknown as ISearchReader);
  });

  it("should successfully list developers with provided query parameters", async () => {
    const mockDevelopers = [
      {
        id: "dev-1",
        name: "CD Projekt Red",
        slug: "cd-projekt-red",
        countryCode: "PL",
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      },
    ];

    mockSearchReader.searchDevelopers.mockResolvedValue({
      items: mockDevelopers,
      total: 1,
    });

    const mockRequest = {
      query: { page: 2, limit: 5, q: "projekt" },
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number; q?: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockSearchReader.searchDevelopers).toHaveBeenCalledWith({
      q: "projekt",
      page: 2,
      limit: 5,
    });

    expect(result).toEqual({
      items: [
        {
          id: "dev-1",
          name: "CD Projekt Red",
          slug: "cd-projekt-red",
          countryCode: "PL",
          createdAt: "2026-06-01T10:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        },
      ],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
  });

  it("should use fallback default parameters when query elements are missing", async () => {
    mockSearchReader.searchDevelopers.mockResolvedValue({
      items: [],
      total: 0,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number; q?: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockSearchReader.searchDevelopers).toHaveBeenCalledWith({
      q: undefined,
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it("should handle null countryCode and null updatedAt fields properly", async () => {
    const mockDevNoDetails = {
      id: "dev-2",
      name: "Anonymous Dev",
      slug: "anonymous-dev",
      countryCode: null,
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: null,
    };

    mockSearchReader.searchDevelopers.mockResolvedValue({
      items: [mockDevNoDetails],
      total: 1,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number; q?: string } }>;

    const result = await handler.handle(mockRequest);

    expect(result.items[0].countryCode).toBeNull();
    expect(result.items[0].updatedAt).toBeNull();
  });
});
