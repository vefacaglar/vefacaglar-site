import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetDocHandler } from "./docs.handler";
import type { IPackagesRepository } from "../packages.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetDocHandler", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: GetDocHandler;

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
    handler = new GetDocHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should throw NotFoundError when package group is not found", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);

    const mockRequest = {
      params: { slug: "missing", docSlug: "intro" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findDocBySlug).not.toHaveBeenCalled();
  });

  it("should throw NotFoundError when package group is inactive", async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "core",
      isActive: false,
    });

    const mockRequest = {
      params: { slug: "core", docSlug: "intro" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });

  it("should throw NotFoundError when doc is not found", async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "core",
      isActive: true,
    });
    mockRepo.findDocBySlug.mockResolvedValue(null);

    const mockRequest = {
      params: { slug: "core", docSlug: "missing" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });

  it("should throw NotFoundError when doc is unpublished", async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "core",
      isActive: true,
    });
    mockRepo.findDocBySlug.mockResolvedValue({
      id: "d-1",
      slug: "hidden",
      isPublished: false,
    });

    const mockRequest = {
      params: { slug: "core", docSlug: "hidden" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });

  it("should return mapped doc with categories and only published docs in the sidebar", async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "core",
      isActive: true,
    });
    mockRepo.findDocBySlug.mockResolvedValue({
      id: "d-1",
      groupId: "g-1",
      categoryId: "c-1",
      slug: "intro",
      title: "Introduction",
      description: "Intro",
      filePath: "docs/intro.md",
      content: "# Hello",
      displayOrder: 1,
      isPublished: true,
    });
    mockRepo.listCategories.mockResolvedValue([
      { id: "c-1", title: "Getting Started", slug: "getting-started", displayOrder: 1 },
    ]);
    mockRepo.listDocs.mockResolvedValue([
      {
        id: "d-1",
        categoryId: "c-1",
        slug: "intro",
        title: "Introduction",
        description: "Intro",
        displayOrder: 1,
        isPublished: true,
      },
      {
        id: "d-2",
        categoryId: "c-1",
        slug: "hidden",
        title: "Hidden",
        description: "Hidden",
        displayOrder: 2,
        isPublished: false,
      },
    ]);

    const mockRequest = {
      params: { slug: "core", docSlug: "intro" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(result.id).toBe("d-1");
    expect(result.filePath).toBe("docs/intro.md");
    expect(result.content).toBe("# Hello");
    expect(result.categories).toHaveLength(1);
    expect(result.docsList).toHaveLength(1);
    expect(result.docsList[0].id).toBe("d-1");
  });
});
