import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetGenreHandler } from "./detail.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("GetGenreHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: GetGenreHandler;

  beforeEach(() => {
    mockCatalog = { getGenreById: vi.fn() };
    handler = new GetGenreHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should return mapped genre", async () => {
    mockCatalog.getGenreById.mockResolvedValue({
      id: "g-1",
      name: "RPG",
      slug: "rpg",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      params: { id: "g-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.getGenreById).toHaveBeenCalledWith("g-1");
    expect(result).toEqual({
      id: "g-1",
      name: "RPG",
      slug: "rpg",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });
  });
});
