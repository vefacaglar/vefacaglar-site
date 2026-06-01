import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetPostHandler } from "./detail.handler";
import type { IPostsRepository } from "../posts.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetPostHandler", () => {
  let mockRepo: Record<keyof IPostsRepository, any>;
  let handler: GetPostHandler;

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

    handler = new GetPostHandler(mockRepo as unknown as IPostsRepository);
  });

  it("should successfully retrieve and map published post details with author", async () => {
    const mockPost = {
      id: "post-1",
      slug: "beautiful-code",
      title: "Beautiful Code",
      excerpt: "Write tests",
      content: "Deep writeup on tests",
      status: "published",
      coverImageUrl: "https://example.com/image.png",
      seoTitle: "Beautiful SEO",
      seoDescription: "Beautiful SEO Description",
      publishedAt: new Date("2026-06-01T12:00:00.000Z"),
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T11:00:00.000Z"),
      authorUsername: "vefa",
      authorDisplayName: "Vefa Çağlar",
    };

    mockRepo.findBySlugWithAuthor.mockResolvedValue(mockPost);

    const mockRequest = {
      params: { slug: "beautiful-code" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.findBySlugWithAuthor).toHaveBeenCalledWith("beautiful-code");
    expect(result).toEqual({
      id: "post-1",
      slug: "beautiful-code",
      title: "Beautiful Code",
      excerpt: "Write tests",
      content: "Deep writeup on tests",
      status: "published",
      coverImageUrl: "https://example.com/image.png",
      seoTitle: "Beautiful SEO",
      seoDescription: "Beautiful SEO Description",
      publishedAt: "2026-06-01T12:00:00.000Z",
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T11:00:00.000Z",
      author: {
        username: "vefa",
        displayName: "Vefa Çağlar",
      },
    });
  });

  it("should successfully map null author relationship properly", async () => {
    const mockPostWithoutAuthor = {
      id: "post-2",
      slug: "anonymous-post",
      title: "Anonymous Post",
      excerpt: "Excerpt",
      content: "Content",
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

    mockRepo.findBySlugWithAuthor.mockResolvedValue(mockPostWithoutAuthor);

    const mockRequest = {
      params: { slug: "anonymous-post" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    const result = await handler.handle(mockRequest);

    expect(result.author).toBeNull();
    expect(result.publishedAt).toBeNull();
  });

  it("should throw NotFoundError if post is not found", async () => {
    mockRepo.findBySlugWithAuthor.mockResolvedValue(null);

    const mockRequest = {
      params: { slug: "non-existent" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findBySlugWithAuthor).toHaveBeenCalledWith("non-existent");
  });

  it("should throw NotFoundError if post is a draft", async () => {
    const mockDraftPost = {
      id: "post-3",
      slug: "draft-post",
      title: "Draft Post",
      status: "draft",
    };

    mockRepo.findBySlugWithAuthor.mockResolvedValue(mockDraftPost);

    const mockRequest = {
      params: { slug: "draft-post" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findBySlugWithAuthor).toHaveBeenCalledWith("draft-post");
  });
});
