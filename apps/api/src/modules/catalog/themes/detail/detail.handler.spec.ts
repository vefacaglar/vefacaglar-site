import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetThemeHandler } from "./detail.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("GetThemeHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: GetThemeHandler;

  beforeEach(() => {
    mockCatalog = { getThemeById: vi.fn() };
    handler = new GetThemeHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should return mapped theme", async () => {
    mockCatalog.getThemeById.mockResolvedValue({
      id: "t-1",
      name: "Dark Fantasy",
      slug: "dark-fantasy",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      params: { id: "t-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.getThemeById).toHaveBeenCalledWith("t-1");
    expect(result).toEqual({
      id: "t-1",
      name: "Dark Fantasy",
      slug: "dark-fantasy",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });
  });
});
