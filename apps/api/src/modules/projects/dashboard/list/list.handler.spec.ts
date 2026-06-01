import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListAdminProjectsHandler } from "./list.handler";
import type { IProjectsRepository } from "../../projects.repository.interface";
import { FastifyRequest } from "fastify";

describe("ListAdminProjectsHandler", () => {
  let mockRepo: Record<keyof IProjectsRepository, any>;
  let handler: ListAdminProjectsHandler;

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
    handler = new ListAdminProjectsHandler(mockRepo as unknown as IProjectsRepository);
  });

  it("should pass status filter and pagination to listRaw", async () => {
    mockRepo.listRaw.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: { status: "published" as const, page: 3, limit: 4 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockRepo.listRaw).toHaveBeenCalledWith({
      status: "published",
      page: 3,
      limit: 4,
    });
  });

  it("should default to page=1 and limit=5 when query parameters are missing", async () => {
    mockRepo.listRaw.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.listRaw).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      limit: 5,
    });
    expect(result.totalPages).toBe(0);
  });

  it("should map all project fields including nullable dates", async () => {
    mockRepo.listRaw.mockResolvedValue({
      items: [
        {
          id: "p-1",
          slug: "x",
          title: "X",
          summary: "S",
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
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
      total: 1,
    });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(result.items[0]).toMatchObject({
      id: "p-1",
      slug: "x",
      title: "X",
      status: "draft",
      publishedAt: null,
    });
    expect(result.items[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("should compute totalPages with Math.ceil", async () => {
    mockRepo.listRaw.mockResolvedValue({ items: [], total: 11 });

    const mockRequest = {
      query: { page: 1, limit: 5 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.totalPages).toBe(3);
  });
});
