import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkGamePublisherHandler } from "./link.handler";
import { UnlinkGamePublisherHandler } from "./unlink.handler";
import { GameCatalogService } from "../../../../catalog.service";
import { FastifyRequest } from "fastify";

describe("LinkGamePublisherHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: LinkGamePublisherHandler;

  beforeEach(() => {
    mockCatalog = { linkGamePublisher: vi.fn() };
    handler = new LinkGamePublisherHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call linkGamePublisher with gameId and publisherId from params", async () => {
    mockCatalog.linkGamePublisher.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", publisherId: "p-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.linkGamePublisher).toHaveBeenCalledWith("g-1", "p-1");
    expect(result).toEqual({ success: true });
  });

  it("should propagate errors", async () => {
    mockCatalog.linkGamePublisher.mockRejectedValue(new Error("dup"));

    const mockRequest = {
      params: { id: "g-1", publisherId: "p-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("dup");
  });
});

describe("UnlinkGamePublisherHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UnlinkGamePublisherHandler;

  beforeEach(() => {
    mockCatalog = { unlinkGamePublisher: vi.fn() };
    handler = new UnlinkGamePublisherHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call unlinkGamePublisher with gameId and publisherId from params", async () => {
    mockCatalog.unlinkGamePublisher.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "g-1", publisherId: "p-1" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.unlinkGamePublisher).toHaveBeenCalledWith("g-1", "p-1");
    expect(result).toEqual({ success: true });
  });
});
