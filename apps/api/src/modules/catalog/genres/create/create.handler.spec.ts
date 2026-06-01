import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateGenreHandler } from "./create.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("CreateGenreHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: CreateGenreHandler;

  beforeEach(() => {
    mockCatalog = { createGenre: vi.fn() };
    handler = new CreateGenreHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call createGenre and map the result", async () => {
    mockCatalog.createGenre.mockResolvedValue({
      id: "g-1",
      name: "RPG",
      slug: "rpg",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      body: { name: "RPG", slug: "rpg" },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.createGenre).toHaveBeenCalledWith({ name: "RPG", slug: "rpg" });
    expect(result).toEqual({
      id: "g-1",
      name: "RPG",
      slug: "rpg",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });
  });
});
