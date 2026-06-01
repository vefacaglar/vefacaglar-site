import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateThemeHandler } from "./update.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("UpdateThemeHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UpdateThemeHandler;

  beforeEach(() => {
    mockCatalog = { updateTheme: vi.fn() };
    handler = new UpdateThemeHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should pass id and patch to updateTheme", async () => {
    mockCatalog.updateTheme.mockResolvedValue({
      id: "t-1",
      name: "Renamed",
      slug: "renamed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "t-1" },
      body: { name: "Renamed", slug: "renamed" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.updateTheme).toHaveBeenCalledWith("t-1", {
      name: "Renamed",
      slug: "renamed",
    });
    expect(result.name).toBe("Renamed");
  });
});
