import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreatePostHandler } from "./create.handler";
import type { IPostsRepository } from "../../posts.repository.interface";
import { FastifyRequest } from "fastify";

describe("CreatePostHandler", () => {
  let mockRepo: Record<keyof IPostsRepository, any>;
  let handler: CreatePostHandler;

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
    handler = new CreatePostHandler(mockRepo as unknown as IPostsRepository);
  });

  it("should create a published post with a publishedAt timestamp and full author info", async () => {
    const createdAt = new Date("2026-06-01T10:00:00.000Z");
    const updatedAt = new Date("2026-06-01T10:00:00.000Z");
    const publishedAt = new Date("2026-06-01T10:05:00.000Z");

    mockRepo.create.mockResolvedValue({
      id: "post-1",
      slug: "new-post",
      title: "New Post",
      excerpt: "An excerpt",
      content: "Body content",
      status: "published",
      coverImageUrl: "https://cdn.example.com/cover.png",
      seoTitle: "SEO title",
      seoDescription: "SEO desc",
      publishedAt,
      createdAt,
      updatedAt,
    });

    const mockRequest = {
      user: {
        id: "user-1",
        username: "vefa",
        displayName: "Vefa Çağlar",
        email: "vefa@example.com",
        role: "admin",
      },
      body: {
        title: "New Post",
        slug: "new-post",
        excerpt: "An excerpt",
        content: "Body content",
        status: "published" as const,
        coverImageUrl: "https://cdn.example.com/cover.png",
        seoTitle: "SEO title",
        seoDescription: "SEO desc",
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.title).toBe("New Post");
    expect(createArg.slug).toBe("new-post");
    expect(createArg.excerpt).toBe("An excerpt");
    expect(createArg.content).toBe("Body content");
    expect(createArg.status).toBe("published");
    expect(createArg.coverImageUrl).toBe("https://cdn.example.com/cover.png");
    expect(createArg.seoTitle).toBe("SEO title");
    expect(createArg.seoDescription).toBe("SEO desc");
    expect(createArg.publishedAt).toBeInstanceOf(Date);
    expect(createArg.authorId).toBe("user-1");

    expect(result).toEqual({
      id: "post-1",
      slug: "new-post",
      title: "New Post",
      excerpt: "An excerpt",
      content: "Body content",
      status: "published",
      coverImageUrl: "https://cdn.example.com/cover.png",
      seoTitle: "SEO title",
      seoDescription: "SEO desc",
      publishedAt: publishedAt.toISOString(),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      author: { username: "vefa", displayName: "Vefa Çağlar" },
    });
  });

  it("should create a draft post with null publishedAt and null optional fields", async () => {
    const createdAt = new Date("2026-06-01T10:00:00.000Z");
    const updatedAt = new Date("2026-06-01T10:00:00.000Z");

    mockRepo.create.mockResolvedValue({
      id: "post-2",
      slug: "draft-post",
      title: "Draft Post",
      excerpt: null,
      content: "Body",
      status: "draft",
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      createdAt,
      updatedAt,
    });

    const mockRequest = {
      user: { id: "user-1", username: "vefa", displayName: "Vefa", email: "a@b.com", role: "admin" },
      body: {
        title: "Draft Post",
        slug: "draft-post",
        content: "Body",
        status: "draft" as const,
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.publishedAt).toBeNull();
    expect(createArg.excerpt).toBeNull();
    expect(createArg.coverImageUrl).toBeNull();
    expect(createArg.seoTitle).toBeNull();
    expect(createArg.seoDescription).toBeNull();

    expect(result.publishedAt).toBeNull();
    expect(result.excerpt).toBeNull();
  });

  it("should normalize empty strings to null for optional fields", async () => {
    mockRepo.create.mockResolvedValue({
      id: "post-3",
      slug: "x",
      title: "X",
      excerpt: null,
      content: "Body",
      status: "draft",
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      user: { id: "u", username: "u", displayName: "U", email: "u@u.com", role: "admin" },
      body: {
        title: "X",
        slug: "x",
        excerpt: "",
        content: "Body",
        status: "draft" as const,
        coverImageUrl: "",
        seoTitle: "",
        seoDescription: "",
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.excerpt).toBeNull();
    expect(createArg.coverImageUrl).toBeNull();
    expect(createArg.seoTitle).toBeNull();
    expect(createArg.seoDescription).toBeNull();
  });
});
