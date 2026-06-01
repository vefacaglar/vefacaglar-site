import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreatePackageHandler } from "./create.handler";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { ConflictError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("CreatePackageHandler", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: CreatePackageHandler;

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
    handler = new CreatePackageHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should throw ConflictError when slug already exists", async () => {
    mockRepo.findBySlug.mockResolvedValue({ id: "existing", slug: "core" });

    const mockRequest = {
      body: { slug: "core", name: "Core" },
    } as unknown as FastifyRequest<{ Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(ConflictError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("should create package with sensible defaults when fields are missing", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      id: "pkg-1",
      slug: "core",
      name: "Core",
      description: null,
      githubUrl: null,
      docs: null,
      latestVersion: "1.0.0",
      isActive: true,
      content: "",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const mockRequest = {
      body: { slug: "core", name: "Core" },
    } as unknown as FastifyRequest<{ Body: any }>;

    await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.slug).toBe("core");
    expect(createArg.name).toBe("Core");
    expect(createArg.description).toBeNull();
    expect(createArg.githubUrl).toBeNull();
    expect(createArg.docs).toBeNull();
    expect(createArg.latestVersion).toBe("1.0.0");
    expect(createArg.isActive).toBe(true);
    expect(createArg.content).toBe("");
  });

  it("should pass through all optional fields when provided", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      id: "pkg-2",
      slug: "core",
      name: "Core",
      description: "Desc",
      githubUrl: "https://github.com/vefa/core",
      docs: "Body",
      latestVersion: "2.0.0",
      isActive: false,
      content: "Markdown body",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      body: {
        slug: "core",
        name: "Core",
        description: "Desc",
        githubUrl: "https://github.com/vefa/core",
        docs: "Body",
        latestVersion: "2.0.0",
        isActive: false,
        content: "Markdown body",
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.description).toBe("Desc");
    expect(createArg.latestVersion).toBe("2.0.0");
    expect(createArg.isActive).toBe(false);
    expect(result.isActive).toBe(false);
    expect(result.nugetUrl).toBeNull();
    expect(result.npmUrl).toBeNull();
  });
});
