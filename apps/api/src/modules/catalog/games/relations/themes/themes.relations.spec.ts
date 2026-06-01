import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkGameThemeHandler } from "./link.handler";
import { UnlinkGameThemeHandler } from "./unlink.handler";
import { GameCatalogService } from "../../../../catalog.service";
import { FastifyRequest } from "fastify";

describe("LinkGameThemeHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: LinkGameThemeHandler;

  beforeEach(() => {
    mockCatalog = { linkGameTheme: vi.fn() };
    handler = new LinkGameThemeHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call linkGameTheme with gameId and themeId from params", async () => {
    mockCatalog.linkGameTheme.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", themeId: "t-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.linkGameTheme).toHaveBeenCalledWith("g-1", "t-1");
    expect(result).toEqual({ success: true });
  });

  it("should propagate errors", async () => {
    mockCatalog.linkGameTheme.mockRejectedValue(new Error("dup"));

    const mockRequest = {
      params: { id: "g-1", themeId: "t-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("dup");
  });
});

describe("UnlinkGameThemeHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UnlinkGameThemeHandler;

  beforeEach(() => {
    mockCatalog = { unlinkGameTheme: vi.fn() };
    handler = new UnlinkGameThemeHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call unlinkGameTheme with gameId and themeId from params", async () => {
    mockCatalog.unlinkGameTheme.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", themeId: "t-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.unlinkGameTheme).toHaveBeenCalledWith("g-1", "t-1");
    expect(result).toEqual({ success: true });
  });
});
