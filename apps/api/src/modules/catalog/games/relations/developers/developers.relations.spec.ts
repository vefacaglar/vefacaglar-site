import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkGameDeveloperHandler } from "./link.handler";
import { UnlinkGameDeveloperHandler } from "./unlink.handler";
import { GameCatalogService } from "../../../../catalog.service";
import { FastifyRequest } from "fastify";

describe("LinkGameDeveloperHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: LinkGameDeveloperHandler;

  beforeEach(() => {
    mockCatalog = { linkGameDeveloper: vi.fn() };
    handler = new LinkGameDeveloperHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call linkGameDeveloper with gameId and developerId from params", async () => {
    mockCatalog.linkGameDeveloper.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", developerId: "d-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.linkGameDeveloper).toHaveBeenCalledWith("g-1", "d-1");
    expect(result).toEqual({ success: true });
  });

  it("should propagate errors", async () => {
    mockCatalog.linkGameDeveloper.mockRejectedValue(new Error("dup"));

    const mockRequest = {
      params: { id: "g-1", developerId: "d-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("dup");
  });
});

describe("UnlinkGameDeveloperHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UnlinkGameDeveloperHandler;

  beforeEach(() => {
    mockCatalog = { unlinkGameDeveloper: vi.fn() };
    handler = new UnlinkGameDeveloperHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call unlinkGameDeveloper with gameId and developerId from params", async () => {
    mockCatalog.unlinkGameDeveloper.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", developerId: "d-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.unlinkGameDeveloper).toHaveBeenCalledWith("g-1", "d-1");
    expect(result).toEqual({ success: true });
  });

  it("should propagate errors", async () => {
    mockCatalog.unlinkGameDeveloper.mockRejectedValue(new Error("missing"));

    const mockRequest = {
      params: { id: "g-1", developerId: "d-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("missing");
  });
});
