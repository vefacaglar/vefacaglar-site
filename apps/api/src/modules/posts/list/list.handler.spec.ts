import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListPostsHandler } from "./list.handler";
import type { IPostsRepository } from "../posts.repository.interface";
import { FastifyRequest } from "fastify";

describe("ListPostsHandler", () => {
  let mockRepo: Record<keyof IPostsRepository, any>;
  let handler: ListPostsHandler;

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

    handler = new ListPostsHandler(mockRepo as unknown as IPostsRepository);
  });

  it("should successfully list posts with provided query parameters", async () => {
    const mockPosts = [
      {
        id: "post-1",
        slug: "first-post",
        title: "First Post",
        excerpt: "This is the first post.",
        status: "published",
        coverImageUrl: "https://example.com/cover1.jpg",
        seoTitle: "First Post SEO",
        seoDescription: "First Post SEO Desc",
        publishedAt: new Date("2026-06-01T12:00:00.000Z"),
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-01T11:00:00.000Z"),
        authorUsername: "vefa",
        authorDisplayName: "Vefa Çağlar",
      },
    ];

    mockRepo.listWithAuthor.mockResolvedValue({
      items: mockPosts,
      total: 1,
    });

    const mockRequest = {
      query: { page: 2, limit: 5 },
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.listWithAuthor).toHaveBeenCalledWith({
      status: "published",
      page: 2,
      limit: 5,
    });

    expect(result).toEqual({
      items: [
        {
          id: "post-1",
          slug: "first-post",
          title: "First Post",
          excerpt: "This is the first post.",
          status: "published",
          coverImageUrl: "https://example.com/cover1.jpg",
          seoTitle: "First Post SEO",
          seoDescription: "First Post SEO Desc",
          publishedAt: "2026-06-01T12:00:00.000Z",
          createdAt: "2026-06-01T10:00:00.000Z",
          updatedAt: "2026-06-01T11:00:00.000Z",
          author: {
            username: "vefa",
            displayName: "Vefa Çağlar",
          },
        },
      ],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
  });

  it("should use fallback default values when page and limit query parameters are missing", async () => {
    mockRepo.listWithAuthor.mockResolvedValue({
      items: [],
      total: 0,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.listWithAuthor).toHaveBeenCalledWith({
      status: "published",
      page: 1,
      limit: 10,
    });

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it("should handle null and missing author relationships properly", async () => {
    const mockPostWithoutAuthor = {
      id: "post-2",
      slug: "no-author-post",
      title: "No Author Post",
      excerpt: "Excerpt",
      status: "published",
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      authorUsername: null,
      authorDisplayName: null,
    };

    mockRepo.listWithAuthor.mockResolvedValue({
      items: [mockPostWithoutAuthor],
      total: 1,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number } }>;

    const result = await handler.handle(mockRequest);

    expect(result.items[0].author).toBeNull();
    expect(result.items[0].publishedAt).toBeNull();
  });
});
