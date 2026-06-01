import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RelationsOptionsHandler } from "./options.handler";
import { GameCatalogService } from "../catalog.service";
import { FastifyRequest } from "fastify";

describe("RelationsOptionsHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: RelationsOptionsHandler;

  beforeEach(() => {
    mockCatalog = { getRelationsOptions: vi.fn() };
    handler = new RelationsOptionsHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call getRelationsOptions and map all three categories", async () => {
    mockCatalog.getRelationsOptions.mockResolvedValue({
      genres: [
        {
          id: "g-1",
          name: "RPG",
          slug: "rpg",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
      platforms: [
        {
          id: "pl-1",
          name: "PC",
          slug: "pc",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          updatedAt: null,
        },
      ],
      themes: [
        {
          id: "t-1",
          name: "Dark Fantasy",
          slug: "dark-fantasy",
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
          updatedAt: null,
        },
      ],
    });

    const result = await handler.handle({} as unknown as FastifyRequest);

    expect(result).toEqual({
      genres: [
        {
          id: "g-1",
          name: "RPG",
          slug: "rpg",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      themes: [
        {
          id: "t-1",
          name: "Dark Fantasy",
          slug: "dark-fantasy",
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: null,
        },
      ],
      platforms: [
        {
          id: "pl-1",
          name: "PC",
          slug: "pc",
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: null,
        },
      ],
    });
  });

  it("should return empty arrays when the service yields no records", async () => {
    mockCatalog.getRelationsOptions.mockResolvedValue({
      genres: [],
      platforms: [],
      themes: [],
    });

    const result = await handler.handle({} as unknown as FastifyRequest);

    expect(result).toEqual({ genres: [], themes: [], platforms: [] });
  });
});
