import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateProjectHandler } from "./update.handler";
import type { IProjectsRepository } from "../../projects.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("UpdateProjectHandler", () => {
  let mockRepo: Record<keyof IProjectsRepository, any>;
  let handler: UpdateProjectHandler;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      list: vi.fn(),
      listRaw: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    handler = new UpdateProjectHandler(mockRepo as unknown as IProjectsRepository);
  });

  it("should throw NotFoundError when project does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
      body: {
        title: "X",
        slug: "x",
        summary: "S",
        content: "C",
        status: "draft" as const,
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("should set publishedAt when transitioning from draft (no publishedAt) to published", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      publishedAt: null,
      featured: false,
      sortOrder: 0,
    });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      summary: "S",
      content: "C",
      status: "published",
      featured: false,
      sortOrder: 0,
      githubUrl: null,
      liveUrl: null,
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      startedAt: null,
      endedAt: null,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { title: "X", slug: "x", summary: "S", content: "C", status: "published" as const },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBeInstanceOf(Date);
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });

  it("should preserve existing publishedAt when republishing", async () => {
    const existingPub = new Date("2025-01-01T00:00:00.000Z");
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      publishedAt: existingPub,
      featured: true,
      sortOrder: 7,
    });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      summary: "S",
      content: "C",
      status: "published",
      featured: true,
      sortOrder: 7,
      githubUrl: null,
      liveUrl: null,
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      startedAt: null,
      endedAt: null,
      publishedAt: existingPub,
      createdAt: existingPub,
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { title: "X", slug: "x", summary: "S", content: "C", status: "published" as const },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBe(existingPub);
  });

  it("should clear publishedAt when status flips to draft", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      publishedAt: new Date(),
      featured: true,
      sortOrder: 1,
    });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      summary: "S",
      content: "C",
      status: "draft",
      featured: true,
      sortOrder: 1,
      githubUrl: null,
      liveUrl: null,
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      startedAt: null,
      endedAt: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { title: "X", slug: "x", summary: "S", content: "C", status: "draft" as const },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBeNull();
  });

  it("should fall back to existing featured/sortOrder when not provided in body", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      publishedAt: null,
      featured: true,
      sortOrder: 42,
    });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      summary: "S",
      content: "C",
      status: "draft",
      featured: true,
      sortOrder: 42,
      githubUrl: null,
      liveUrl: null,
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      startedAt: null,
      endedAt: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { title: "X", slug: "x", summary: "S", content: "C", status: "draft" as const },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.featured).toBe(true);
    expect(patch.sortOrder).toBe(42);
  });

  it("should normalize empty optional strings to null", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      publishedAt: null,
      featured: false,
      sortOrder: 0,
    });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      summary: "S",
      content: "C",
      status: "draft",
      featured: false,
      sortOrder: 0,
      githubUrl: null,
      liveUrl: null,
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      startedAt: null,
      endedAt: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: {
        title: "X",
        slug: "x",
        summary: "S",
        content: "C",
        status: "draft" as const,
        githubUrl: "",
        liveUrl: "",
        coverImageUrl: "",
        seoTitle: "",
        seoDescription: "",
        startedAt: "",
        endedAt: "",
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.githubUrl).toBeNull();
    expect(patch.liveUrl).toBeNull();
    expect(patch.coverImageUrl).toBeNull();
    expect(patch.seoTitle).toBeNull();
    expect(patch.seoDescription).toBeNull();
    expect(patch.startedAt).toBeNull();
    expect(patch.endedAt).toBeNull();
  });
});
