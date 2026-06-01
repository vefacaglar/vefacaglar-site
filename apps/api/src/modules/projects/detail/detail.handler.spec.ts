import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetProjectHandler } from "./detail.handler";
import type { IProjectsRepository } from "../projects.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetProjectHandler", () => {
  let mockRepo: Record<keyof IProjectsRepository, any>;
  let handler: GetProjectHandler;

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

    handler = new GetProjectHandler(mockRepo as unknown as IProjectsRepository);
  });

  it("should successfully retrieve and map project details when it is active and published", async () => {
    const mockProject = {
      id: "project-1",
      slug: "cool-project",
      title: "Cool Project",
      summary: "Short summary",
      content: "Deep project explanation",
      status: "published",
      featured: true,
      sortOrder: 1,
      githubUrl: "https://github.com/vefa/cool",
      liveUrl: "https://cool.vefa.dev",
      coverImageUrl: "https://example.com/cover.png",
      seoTitle: "Cool SEO",
      seoDescription: "Cool SEO Desc",
      startedAt: "2026-01-01",
      endedAt: "2026-03-01",
      publishedAt: new Date("2026-03-01T12:00:00.000Z"),
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-01T12:00:00.000Z"),
    };

    mockRepo.findBySlug.mockResolvedValue(mockProject);

    const mockRequest = {
      params: { slug: "cool-project" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.findBySlug).toHaveBeenCalledWith("cool-project");
    expect(result).toEqual({
      id: "project-1",
      slug: "cool-project",
      title: "Cool Project",
      summary: "Short summary",
      content: "Deep project explanation",
      status: "published",
      featured: true,
      sortOrder: 1,
      githubUrl: "https://github.com/vefa/cool",
      liveUrl: "https://cool.vefa.dev",
      coverImageUrl: "https://example.com/cover.png",
      seoTitle: "Cool SEO",
      seoDescription: "Cool SEO Desc",
      startedAt: "2026-01-01",
      endedAt: "2026-03-01",
      publishedAt: "2026-03-01T12:00:00.000Z",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-03-01T12:00:00.000Z",
    });
  });

  it("should throw NotFoundError if project is not found", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);

    const mockRequest = {
      params: { slug: "non-existent" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findBySlug).toHaveBeenCalledWith("non-existent");
  });

  it("should throw NotFoundError if project status is not published (e.g., draft)", async () => {
    const mockDraftProject = {
      id: "project-2",
      slug: "draft-project",
      title: "Draft Project",
      status: "draft",
    };

    mockRepo.findBySlug.mockResolvedValue(mockDraftProject);

    const mockRequest = {
      params: { slug: "draft-project" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findBySlug).toHaveBeenCalledWith("draft-project");
  });
});
