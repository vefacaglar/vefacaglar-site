import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdatePackageHandler } from "./update.handler";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { NotFoundError, ConflictError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("UpdatePackageHandler", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: UpdatePackageHandler;

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
    handler = new UpdatePackageHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should throw NotFoundError when package does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
      body: { slug: "core", name: "Core" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("should not check slug conflict when slug is unchanged", async () => {
    mockRepo.findById.mockResolvedValue({ id: "p-1", slug: "core" });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "core",
      name: "Core v2",
      description: null,
      githubUrl: null,
      docs: null,
      latestVersion: "1.0.0",
      isActive: true,
      content: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { slug: "core", name: "Core v2" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    expect(mockRepo.findBySlug).not.toHaveBeenCalled();
    expect(mockRepo.update).toHaveBeenCalled();
  });

  it("should throw ConflictError when the new slug is taken by another package", async () => {
    mockRepo.findById.mockResolvedValue({ id: "p-1", slug: "core" });
    mockRepo.findBySlug.mockResolvedValue({ id: "p-2", slug: "core-utils" });

    const mockRequest = {
      params: { id: "p-1" },
      body: { slug: "core-utils", name: "Core Utils" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(ConflictError);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("should not throw when the slug change refers to the same package", async () => {
    mockRepo.findById.mockResolvedValue({ id: "p-1", slug: "core" });
    mockRepo.findBySlug.mockResolvedValue({ id: "p-1", slug: "core" });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "core",
      name: "Core",
      description: null,
      githubUrl: null,
      docs: null,
      latestVersion: "1.0.0",
      isActive: true,
      content: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { slug: "core", name: "Core" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await expect(handler.handle(mockRequest)).resolves.toBeDefined();
  });

  it("should pass through optional fields including null values", async () => {
    mockRepo.findById.mockResolvedValue({ id: "p-1", slug: "core" });
    mockRepo.update.mockResolvedValue({
      id: "p-1",
      slug: "core",
      name: "Core",
      description: null,
      githubUrl: null,
      docs: null,
      latestVersion: "1.0.0",
      isActive: true,
      content: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: {
        slug: "core",
        name: "Core",
        description: null,
        githubUrl: null,
        docs: null,
        latestVersion: "1.0.0",
        isActive: true,
        content: "",
      },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await handler.handle(mockRequest);

    const patch = mockRepo.update.mock.calls[0][1];
    expect(patch.description).toBeNull();
    expect(patch.githubUrl).toBeNull();
    expect(patch.docs).toBeNull();
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });
});
