import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteGameHandler } from "./delete.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("DeleteGameHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: DeleteGameHandler;

  beforeEach(() => {
    mockCatalog = { deleteGame: vi.fn() };
    handler = new DeleteGameHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call deleteGame and return success", async () => {
    mockCatalog.deleteGame.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.deleteGame).toHaveBeenCalledWith("g-1");
    expect(result).toEqual({ success: true });
  });
});
