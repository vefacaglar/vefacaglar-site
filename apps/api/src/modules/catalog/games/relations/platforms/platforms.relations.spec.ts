import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkGamePlatformHandler } from "./link.handler";
import { UnlinkGamePlatformHandler } from "./unlink.handler";
import { GameCatalogService } from "../../../../catalog.service";
import { FastifyRequest } from "fastify";

describe("LinkGamePlatformHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: LinkGamePlatformHandler;

  beforeEach(() => {
    mockCatalog = { linkGamePlatform: vi.fn() };
    handler = new LinkGamePlatformHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call linkGamePlatform with gameId and platformId from params", async () => {
    mockCatalog.linkGamePlatform.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", platformId: "pl-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.linkGamePlatform).toHaveBeenCalledWith("g-1", "pl-1");
    expect(result).toEqual({ success: true });
  });

  it("should propagate errors", async () => {
    mockCatalog.linkGamePlatform.mockRejectedValue(new Error("dup"));

    const mockRequest = {
      params: { id: "g-1", platformId: "pl-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("dup");
  });
});

describe("UnlinkGamePlatformHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UnlinkGamePlatformHandler;

  beforeEach(() => {
    mockCatalog = { unlinkGamePlatform: vi.fn() };
    handler = new UnlinkGamePlatformHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call unlinkGamePlatform with gameId and platformId from params", async () => {
    mockCatalog.unlinkGamePlatform.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", platformId: "pl-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.unlinkGamePlatform).toHaveBeenCalledWith("g-1", "pl-1");
    expect(result).toEqual({ success: true });
  });
});
