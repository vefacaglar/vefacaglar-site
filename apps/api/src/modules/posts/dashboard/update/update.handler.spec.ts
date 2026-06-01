import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdatePostHandler } from "./update.handler";
import type { IPostsRepository } from "../../posts.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("UpdatePostHandler", () => {
  let mockRepo: Record<keyof IPostsRepository, any>;
  let handler: UpdatePostHandler;
  const user = {
    id: "user-1",
    username: "vefa",
    displayName: "Vefa Çağlar",
    email: "vefa@example.com",
    role: "admin",
  };

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
    handler = new UpdatePostHandler(mockRepo as unknown as IPostsRepository);
  });

  it("should throw NotFoundError when the post does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      user,
      params: { id: "missing" },
      body: {
        title: "X",
        slug: "x",
        content: "C",
        status: "draft" as const,
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("should set publishedAt when transitioning from draft to published", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "post-1",
      publishedAt: null,
    });
    mockRepo.update.mockResolvedValue({
      id: "post-1",
      slug: "x",
      title: "X",
      excerpt: null,
      content: "C",
      status: "published",
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: new Date("2026-06-01T10:00:00.000Z"),
      createdAt: new Date("2026-06-01T09:00:00.000Z"),
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    });

    const mockRequest = {
      user,
      params: { id: "post-1" },
      body: {
        title: "X",
        slug: "x",
        content: "C",
        status: "published" as const,
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBeInstanceOf(Date);
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });

  it("should preserve existing publishedAt when post is republished", async () => {
    const existingPub = new Date("2025-01-01T00:00:00.000Z");
    mockRepo.findById.mockResolvedValue({
      id: "post-1",
      publishedAt: existingPub,
    });
    mockRepo.update.mockResolvedValue({
      id: "post-1",
      slug: "x",
      title: "X",
      excerpt: null,
      content: "C",
      status: "published",
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: existingPub,
      createdAt: existingPub,
      updatedAt: new Date(),
    });

    const mockRequest = {
      user,
      params: { id: "post-1" },
      body: {
        title: "X",
        slug: "x",
        content: "C",
        status: "published" as const,
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBe(existingPub);
  });

  it("should clear publishedAt when status flips to draft", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "post-1",
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    mockRepo.update.mockResolvedValue({
      id: "post-1",
      slug: "x",
      title: "X",
      excerpt: null,
      content: "C",
      status: "draft",
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      user,
      params: { id: "post-1" },
      body: {
        title: "X",
        slug: "x",
        content: "C",
        status: "draft" as const,
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBeNull();
  });

  it("should map response author from request user, not from the database row", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "post-1",
      publishedAt: new Date(),
    });
    mockRepo.update.mockResolvedValue({
      id: "post-1",
      slug: "x",
      title: "X",
      excerpt: null,
      content: "C",
      status: "published",
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      user,
      params: { id: "post-1" },
      body: {
        title: "X",
        slug: "x",
        content: "C",
        status: "published" as const,
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.author).toEqual({ username: "vefa", displayName: "Vefa Çağlar" });
  });
});
