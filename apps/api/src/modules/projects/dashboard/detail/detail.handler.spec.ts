import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetAdminProjectHandler } from "./detail.handler";
import type { IProjectsRepository } from "../../projects.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetAdminProjectHandler", () => {
  let mockRepo: Record<keyof IProjectsRepository, any>;
  let handler: GetAdminProjectHandler;

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
    handler = new GetAdminProjectHandler(mockRepo as unknown as IProjectsRepository);
  });

  it("should return mapped project with all nullable fields preserved", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      slug: "x",
      title: "X",
      summary: "S",
      content: "Body",
      status: "draft",
      featured: true,
      sortOrder: 1,
      githubUrl: "https://github.com/vefa/x",
      liveUrl: "https://x.vefa.dev",
      coverImageUrl: "https://cdn.example.com/x.png",
      seoTitle: "SEO",
      seoDescription: "SEOd",
      startedAt: "2026-01-01",
      endedAt: "2026-02-01",
      publishedAt: new Date("2026-02-02T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-02T00:00:00.000Z"),
    });

    const mockRequest = {
      params: { id: "p-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(result).toEqual({
      id: "p-1",
      slug: "x",
      title: "X",
      summary: "S",
      content: "Body",
      status: "draft",
      featured: true,
      sortOrder: 1,
      githubUrl: "https://github.com/vefa/x",
      liveUrl: "https://x.vefa.dev",
      coverImageUrl: "https://cdn.example.com/x.png",
      seoTitle: "SEO",
      seoDescription: "SEOd",
      startedAt: "2026-01-01",
      endedAt: "2026-02-01",
      publishedAt: "2026-02-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
    });
  });

  it("should throw NotFoundError when project does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });

  it("should map null publishedAt to null string", async () => {
    mockRepo.findById.mockResolvedValue({
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
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);
    expect(result.publishedAt).toBeNull();
  });
});
