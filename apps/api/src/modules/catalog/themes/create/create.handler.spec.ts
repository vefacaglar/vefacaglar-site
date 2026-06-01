import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateThemeHandler } from "./create.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("CreateThemeHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: CreateThemeHandler;

  beforeEach(() => {
    mockCatalog = { createTheme: vi.fn() };
    handler = new CreateThemeHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call createTheme and map the result", async () => {
    mockCatalog.createTheme.mockResolvedValue({
      id: "t-1",
      name: "Dark Fantasy",
      slug: "dark-fantasy",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      body: { name: "Dark Fantasy", slug: "dark-fantasy" },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.createTheme).toHaveBeenCalledWith({
      name: "Dark Fantasy",
      slug: "dark-fantasy",
    });
    expect(result).toEqual({
      id: "t-1",
      name: "Dark Fantasy",
      slug: "dark-fantasy",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });
  });
});
