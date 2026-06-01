import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListProjectsHandler } from "./list.handler";
import type { IProjectsRepository } from "../projects.repository.interface";
import { FastifyRequest } from "fastify";

describe("ListProjectsHandler", () => {
  let mockRepo: Record<keyof IProjectsRepository, any>;
  let handler: ListProjectsHandler;

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

    handler = new ListProjectsHandler(mockRepo as unknown as IProjectsRepository);
  });

  it("should successfully list projects with provided query parameters", async () => {
    const mockProjects = [
      {
        id: "project-1",
        slug: "cool-project",
        title: "Cool Project",
        summary: "Short summary",
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
      },
    ];

    mockRepo.list.mockResolvedValue({
      items: mockProjects,
      total: 1,
    });

    const mockRequest = {
      query: { page: 3, limit: 4 },
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.list).toHaveBeenCalledWith({
      status: "published",
      page: 3,
      limit: 4,
    });

    expect(result).toEqual({
      items: [
        {
          id: "project-1",
          slug: "cool-project",
          title: "Cool Project",
          summary: "Short summary",
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
        },
      ],
      total: 1,
      page: 3,
      limit: 4,
      totalPages: 1,
    });
  });

  it("should use fallback default values when page and limit query parameters are missing", async () => {
    mockRepo.list.mockResolvedValue({
      items: [],
      total: 0,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.list).toHaveBeenCalledWith({
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

  it("should correctly handle null publishedAt fields", async () => {
    const mockProjectNoPub = {
      id: "project-2",
      slug: "no-pub-project",
      title: "No Pub",
      summary: "Summary",
      status: "published",
      featured: false,
      sortOrder: 2,
      githubUrl: null,
      liveUrl: null,
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      startedAt: null,
      endedAt: null,
      publishedAt: null,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    };

    mockRepo.list.mockResolvedValue({
      items: [mockProjectNoPub],
      total: 1,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: { page?: number; limit?: number } }>;

    const result = await handler.handle(mockRequest);

    expect(result.items[0].publishedAt).toBeNull();
  });
});
