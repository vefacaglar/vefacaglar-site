import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteGenreHandler } from "./delete.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("DeleteGenreHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: DeleteGenreHandler;

  beforeEach(() => {
    mockCatalog = { deleteGenre: vi.fn() };
    handler = new DeleteGenreHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call deleteGenre and return success", async () => {
    mockCatalog.deleteGenre.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.deleteGenre).toHaveBeenCalledWith("g-1");
    expect(result).toEqual({ success: true });
  });
});
