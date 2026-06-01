import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetAdminPageHandler } from "./detail.handler";
import type { IPagesRepository } from "../../pages.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetAdminPageHandler", () => {
  let mockRepo: Record<keyof IPagesRepository, any>;
  let handler: GetAdminPageHandler;

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
    handler = new GetAdminPageHandler(mockRepo as unknown as IPagesRepository);
  });

  it("should return mapped page including content", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      content: "Body",
      status: "draft",
      seoTitle: "SEO",
      seoDescription: "SEOd",
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    const mockRequest = {
      params: { id: "p-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(result).toEqual({
      id: "p-1",
      slug: "x",
      title: "X",
      content: "Body",
      status: "draft",
      seoTitle: "SEO",
      seoDescription: "SEOd",
      publishedAt: "2026-06-01T00:00:00.000Z",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
  });

  it("should throw NotFoundError when page does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });
});
