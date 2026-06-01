import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetAdminPackageHandler } from "./detail.handler";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetAdminPackageHandler", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: GetAdminPackageHandler;

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
    handler = new GetAdminPackageHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should return mapped package with isActive and timestamps", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "p-1",
      slug: "core",
      name: "Core",
      description: "Core description",
      githubUrl: "https://github.com/vefa/core",
      docs: "Doc body",
      latestVersion: "1.0.0",
      isActive: true,
      content: "Body",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const mockRequest = {
      params: { id: "p-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(result).toEqual({
      id: "p-1",
      slug: "core",
      name: "Core",
      description: "Core description",
      nugetUrl: null,
      npmUrl: null,
      githubUrl: "https://github.com/vefa/core",
      docs: "Doc body",
      latestVersion: "1.0.0",
      isActive: true,
      content: "Body",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("should throw NotFoundError when package does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });
});
