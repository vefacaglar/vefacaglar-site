import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdatePageHandler } from "./update.handler";
import type { IPagesRepository } from "../../pages.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("UpdatePageHandler", () => {
  let mockRepo: Record<keyof IPagesRepository, any>;
  let handler: UpdatePageHandler;

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
    handler = new UpdatePageHandler(mockRepo as unknown as IPagesRepository);
  });

  it("should throw NotFoundError when page does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
      body: { title: "X", slug: "x", content: "C", status: "draft" as const },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("should set publishedAt when transitioning from draft to published", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      publishedAt: null,
    });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      content: "C",
      status: "published",
      seoTitle: null,
      seoDescription: null,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { title: "X", slug: "x", content: "C", status: "published" as const },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBeInstanceOf(Date);
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });

  it("should preserve existing publishedAt when republishing", async () => {
    const existingPub = new Date("2025-01-01T00:00:00.000Z");
    mockRepo.findById.mockResolvedValue({ id: "p-1", publishedAt: existingPub });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      content: "C",
      status: "published",
      seoTitle: null,
      seoDescription: null,
      publishedAt: existingPub,
      createdAt: existingPub,
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { title: "X", slug: "x", content: "C", status: "published" as const },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBe(existingPub);
  });

  it("should clear publishedAt when status flips to draft", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      publishedAt: new Date(),
    });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      content: "C",
      status: "draft",
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { title: "X", slug: "x", content: "C", status: "draft" as const },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.publishedAt).toBeNull();
  });

  it("should normalize empty SEO strings to null", async () => {
    mockRepo.findById.mockResolvedValue({ id: "p-1", publishedAt: null });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      content: "C",
      status: "draft",
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: {
        title: "X",
        slug: "x",
        content: "C",
        status: "draft" as const,
        seoTitle: "",
        seoDescription: "",
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.seoTitle).toBeNull();
    expect(patch.seoDescription).toBeNull();
  });
});
