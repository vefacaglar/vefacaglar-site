import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListAdminPostsHandler } from "./list.handler";
import type { IPostsRepository } from "../../posts.repository.interface";
import { FastifyRequest } from "fastify";

describe("ListAdminPostsHandler", () => {
  let mockRepo: Record<keyof IPostsRepository, any>;
  let handler: ListAdminPostsHandler;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlugWithAuthor: vi.fn(),
      listWithAuthor: vi.fn(),
      listRawWithAuthor: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listPublishedByAuthorId: vi.fn(),
    };
    handler = new ListAdminPostsHandler(mockRepo as unknown as IPostsRepository);
  });

  it("should pass status filter and pagination through to listRawWithAuthor", async () => {
    mockRepo.listRawWithAuthor.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: { status: "draft" as const, page: 2, limit: 7 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockRepo.listRawWithAuthor).toHaveBeenCalledWith({
      status: "draft",
      page: 2,
      limit: 7,
    });
  });

  it("should default to page=1 and limit=5 when query parameters are missing", async () => {
    mockRepo.listRawWithAuthor.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.listRawWithAuthor).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      limit: 5,
    });
    expect(result.totalPages).toBe(0);
  });

  it("should map rows including null publishedAt and null author fields", async () => {
    mockRepo.listRawWithAuthor.mockResolvedValue({
      items: [
        {
          id: "p1",
          slug: "s",
          title: "T",
          excerpt: null,
          status: "draft",
          coverImageUrl: null,
          seoTitle: null,
          seoDescription: null,
          publishedAt: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          authorUsername: null,
          authorDisplayName: null,
        },
      ],
      total: 1,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].publishedAt).toBeNull();
    expect(result.items[0].author).toBeNull();
  });

  it("should compute totalPages using Math.ceil", async () => {
    mockRepo.listRawWithAuthor.mockResolvedValue({ items: [], total: 23 });

    const mockRequest = {
      query: { page: 1, limit: 10 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.totalPages).toBe(3);
  });
});
