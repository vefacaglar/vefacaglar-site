import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteThemeHandler } from "./delete.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("DeleteThemeHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: DeleteThemeHandler;

  beforeEach(() => {
    mockCatalog = { deleteTheme: vi.fn() };
    handler = new DeleteThemeHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call deleteTheme and return success", async () => {
    mockCatalog.deleteTheme.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "t-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.deleteTheme).toHaveBeenCalledWith("t-1");
    expect(result).toEqual({ success: true });
  });
});
