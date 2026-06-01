import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateGenreHandler } from "./update.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("UpdateGenreHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UpdateGenreHandler;

  beforeEach(() => {
    mockCatalog = { updateGenre: vi.fn() };
    handler = new UpdateGenreHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should pass id and patch to updateGenre and map the result", async () => {
    mockCatalog.updateGenre.mockResolvedValue({
      id: "g-1",
      name: "Renamed",
      slug: "renamed",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    const mockRequest = {
      params: { id: "g-1" },
      body: { name: "Renamed", slug: "renamed" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.updateGenre).toHaveBeenCalledWith("g-1", {
      name: "Renamed",
      slug: "renamed",
    });
    expect(result.name).toBe("Renamed");
    expect(result.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });
});
