import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListAdminPackagesHandler } from "./list.handler";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { FastifyRequest } from "fastify";

describe("ListAdminPackagesHandler", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: ListAdminPackagesHandler;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createPackageItem: vi.fn(),
      listPackageItems: vi.fn(),
      updatePackageItem: vi.fn(),
      deletePackageItem: vi.fn(),
      findPackageItemById: vi.fn(),
      findPackageItemBySlug: vi.fn(),
      findPackageItemByGroupAndSlug: vi.fn(),
      createCategory: vi.fn(),
      listCategories: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      findCategoryById: vi.fn(),
      findCategoryBySlug: vi.fn(),
      createDoc: vi.fn(),
      listDocs: vi.fn(),
      updateDoc: vi.fn(),
      deleteDoc: vi.fn(),
      findDocById: vi.fn(),
      findDocBySlug: vi.fn(),
    };
    handler = new ListAdminPackagesHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should pass page/limit/q (no isActive filter) to the repository", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: { page: 2, limit: 5, q: "core" },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockRepo.list).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      q: "core",
    });
  });

  it("should default to page=1 and limit=10 when query parameters are missing", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: {},
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.list).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      q: undefined,
    });
    expect(result.totalPages).toBe(0);
  });

  it("should map rows including isActive and timestamps in dashboard response", async () => {
    mockRepo.list.mockResolvedValue({
      items: [
        {
          id: "pkg-1",
          slug: "core",
          name: "Core",
          description: "Core",
          githubUrl: "https://github.com/vefa/core",
          docs: "Doc body",
          latestVersion: "1.0.0",
          isActive: true,
          packageCount: 3,
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

    expect(result.items[0]).toEqual({
      id: "pkg-1",
      slug: "core",
      name: "Core",
      description: "Core",
      nugetUrl: null,
      npmUrl: null,
      githubUrl: "https://github.com/vefa/core",
      docs: "Doc body",
      latestVersion: "1.0.0",
      isActive: true,
      packageCount: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });
});
