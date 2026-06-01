import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListAdminPagesHandler } from "./list.handler";
import type { IPagesRepository } from "../../pages.repository.interface";
import { FastifyRequest } from "fastify";

describe("ListAdminPagesHandler", () => {
  let mockRepo: Record<keyof IPagesRepository, any>;
  let handler: ListAdminPagesHandler;

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
    handler = new ListAdminPagesHandler(mockRepo as unknown as IPagesRepository);
  });

  it("should pass status filter and pagination to listRaw", async () => {
    mockRepo.listRaw.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: { status: "draft" as const, page: 2, limit: 7 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockRepo.listRaw).toHaveBeenCalledWith({
      status: "draft",
      page: 2,
      limit: 7,
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

  it("should map nullable fields to null when missing", async () => {
    mockRepo.listRaw.mockResolvedValue({
      items: [
        {
          id: "p-1",
          slug: "x",
          title: "X",
          status: "draft",
          seoTitle: null,
          seoDescription: null,
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

    expect(result.items[0].publishedAt).toBeNull();
    expect(result.items[0].seoTitle).toBeNull();
    expect(result.items[0].seoDescription).toBeNull();
  });

  it("should compute totalPages using Math.ceil", async () => {
    mockRepo.listRaw.mockResolvedValue({ items: [], total: 11 });

    const mockRequest = {
      query: { page: 1, limit: 5 },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.totalPages).toBe(3);
  });
});
