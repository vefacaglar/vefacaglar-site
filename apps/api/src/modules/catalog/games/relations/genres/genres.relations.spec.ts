import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkGameGenreHandler } from "./link.handler";
import { UnlinkGameGenreHandler } from "./unlink.handler";
import { GameCatalogService } from "../../../../catalog.service";
import { FastifyRequest } from "fastify";

describe("LinkGameGenreHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: LinkGameGenreHandler;

  beforeEach(() => {
    mockCatalog = { linkGameGenre: vi.fn() };
    handler = new LinkGameGenreHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call linkGameGenre with gameId and genreId from params", async () => {
    mockCatalog.linkGameGenre.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", genreId: "ge-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.linkGameGenre).toHaveBeenCalledWith("g-1", "ge-1");
    expect(result).toEqual({ success: true });
  });

  it("should propagate errors", async () => {
    mockCatalog.linkGameGenre.mockRejectedValue(new Error("dup"));

    const mockRequest = {
      params: { id: "g-1", genreId: "ge-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("dup");
  });
});

describe("UnlinkGameGenreHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UnlinkGameGenreHandler;

  beforeEach(() => {
    mockCatalog = { unlinkGameGenre: vi.fn() };
    handler = new UnlinkGameGenreHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call unlinkGameGenre with gameId and genreId from params", async () => {
    mockCatalog.unlinkGameGenre.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", genreId: "ge-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.unlinkGameGenre).toHaveBeenCalledWith("g-1", "ge-1");
    expect(result).toEqual({ success: true });
  });
});
