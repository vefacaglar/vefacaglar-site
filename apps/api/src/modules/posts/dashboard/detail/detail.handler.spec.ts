import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetAdminPostHandler } from "./detail.handler";
import type { IPostsRepository } from "../../posts.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetAdminPostHandler", () => {
  let mockRepo: Record<keyof IPostsRepository, any>;
  let handler: GetAdminPostHandler;

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
    handler = new GetAdminPostHandler(mockRepo as unknown as IPostsRepository);
  });

  it("should return mapped post with author set to null (dashboard does not include author)", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "post-1",
      slug: "x",
      title: "X",
      excerpt: "Ex",
      content: "Body",
      status: "draft",
      coverImageUrl: "https://cdn.example.com/x.png",
      seoTitle: "SEO",
      seoDescription: "SEOd",
      publishedAt: new Date("2026-06-01T10:00:00.000Z"),
      createdAt: new Date("2026-05-30T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    });

    const mockRequest = {
      params: { id: "post-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.findById).toHaveBeenCalledWith("post-1");
    expect(result).toEqual({
      id: "post-1",
      slug: "x",
      title: "X",
      excerpt: "Ex",
      content: "Body",
      status: "draft",
      coverImageUrl: "https://cdn.example.com/x.png",
      seoTitle: "SEO",
      seoDescription: "SEOd",
      publishedAt: "2026-06-01T10:00:00.000Z",
      createdAt: "2026-05-30T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
      author: null,
    });
  });

  it("should map null publishedAt to null string", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "post-2",
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
      params: { id: "post-2" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);
    expect(result.publishedAt).toBeNull();
  });

  it("should throw NotFoundError when post does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });
});
