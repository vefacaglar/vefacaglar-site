import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetPackageHandler } from "./detail.handler";
import type { IPackagesRepository } from "../packages.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetPackageHandler", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: GetPackageHandler;

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

    handler = new GetPackageHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should return package detail correctly when active package is found", async () => {
    const mockPackage = {
      id: "pkg-1",
      slug: "test-package",
      name: "Test Package",
      description: "A package for testing",
      isActive: true,
      githubUrl: "https://github.com/vefa/test-package",
      docs: "Some docs content",
      latestVersion: "1.0.0",
      content: "Detailed content",
    };

    const mockPackageItems = [
      {
        id: "item-1",
        groupId: "pkg-1",
        slug: "test-sub-item",
        name: "Sub Item",
        description: "Sub package item description",
        nugetUrl: "https://nuget.org/test-sub-item",
        npmUrl: "https://npm.org/test-sub-item",
        githubUrl: "https://github.com/vefa/test-sub-item",
        latestVersion: "1.0.0",
        isActive: true,
        content: "Sub item content",
      },
      {
        id: "item-2",
        groupId: "pkg-1",
        slug: "inactive-sub-item",
        name: "Inactive Sub Item",
        description: "Inactive sub package item",
        nugetUrl: null,
        npmUrl: null,
        githubUrl: null,
        latestVersion: "0.1.0",
        isActive: false,
        content: "Inactive",
      },
    ];

    const mockCategories = [
      {
        id: "cat-1",
        title: "Getting Started",
        slug: "getting-started",
        displayOrder: 1,
      },
    ];

    const mockDocs = [
      {
        id: "doc-1",
        categoryId: "cat-1",
        slug: "introduction",
        title: "Introduction",
        description: "Intro doc description",
        displayOrder: 1,
        isPublished: true,
      },
      {
        id: "doc-2",
        categoryId: "cat-1",
        slug: "hidden",
        title: "Hidden Doc",
        description: "Unpublished doc",
        displayOrder: 2,
        isPublished: false,
      },
    ];

    mockRepo.findBySlug.mockResolvedValue(mockPackage);
    mockRepo.listPackageItems.mockResolvedValue(mockPackageItems);
    mockRepo.listCategories.mockResolvedValue(mockCategories);
    mockRepo.listDocs.mockResolvedValue(mockDocs);

    const mockRequest = {
      params: { slug: "test-package" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.findBySlug).toHaveBeenCalledWith("test-package");
    expect(mockRepo.listPackageItems).toHaveBeenCalledWith("pkg-1");
    expect(mockRepo.listCategories).toHaveBeenCalledWith("pkg-1");
    expect(mockRepo.listDocs).toHaveBeenCalledWith("pkg-1");

    expect(result).toEqual({
      id: "pkg-1",
      slug: "test-package",
      name: "Test Package",
      description: "A package for testing",
      nugetUrl: null,
      npmUrl: null,
      githubUrl: "https://github.com/vefa/test-package",
      docs: "Some docs content",
      latestVersion: "1.0.0",
      content: "Detailed content",
      packages: [
        {
          id: "item-1",
          groupId: "pkg-1",
          slug: "test-sub-item",
          name: "Sub Item",
          description: "Sub package item description",
          nugetUrl: "https://nuget.org/test-sub-item",
          npmUrl: "https://npm.org/test-sub-item",
          githubUrl: "https://github.com/vefa/test-sub-item",
          latestVersion: "1.0.0",
          isActive: true,
          content: "Sub item content",
        },
      ],
      categories: [
        {
          id: "cat-1",
          title: "Getting Started",
          slug: "getting-started",
          displayOrder: 1,
        },
      ],
      docsList: [
        {
          id: "doc-1",
          categoryId: "cat-1",
          slug: "introduction",
          title: "Introduction",
          description: "Intro doc description",
          displayOrder: 1,
        },
      ],
    });
  });

  it("should throw NotFoundError if package is not found", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);

    const mockRequest = {
      params: { slug: "non-existent" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findBySlug).toHaveBeenCalledWith("non-existent");
  });

  it("should throw NotFoundError if package is inactive", async () => {
    const mockPackage = {
      id: "pkg-1",
      slug: "test-package",
      name: "Test Package",
      isActive: false,
    };

    mockRepo.findBySlug.mockResolvedValue(mockPackage);

    const mockRequest = {
      params: { slug: "test-package" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findBySlug).toHaveBeenCalledWith("test-package");
  });
});
