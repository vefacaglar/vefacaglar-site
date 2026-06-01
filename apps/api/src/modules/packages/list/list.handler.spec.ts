import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListPackagesHandler } from "./list.handler";
import type { IPackagesRepository } from "../packages.repository.interface";
import { FastifyRequest } from "fastify";

describe("ListPackagesHandler (public)", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: ListPackagesHandler;

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
    handler = new ListPackagesHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should always force isActive=true in the public listing", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {
      query: { page: 2, limit: 4, q: "core" },
    } as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockRepo.list).toHaveBeenCalledWith({
      page: 2,
      limit: 4,
      q: "core",
      isActive: true,
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
      isActive: true,
    });
    expect(result.totalPages).toBe(0);
  });

  it("should map rows and force nugetUrl/npmUrl to null in public response", async () => {
    mockRepo.list.mockResolvedValue({
      items: [
        {
          id: "pkg-1",
          slug: "core",
          name: "Core",
          description: "Core package",
          githubUrl: "https://github.com/vefa/core",
          docs: "Doc body",
          latestVersion: "1.2.0",
          packageCount: 3,
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
      description: "Core package",
      nugetUrl: null,
      npmUrl: null,
      githubUrl: "https://github.com/vefa/core",
      docs: "Doc body",
      latestVersion: "1.2.0",
      packageCount: 3,
    });
  });
});
