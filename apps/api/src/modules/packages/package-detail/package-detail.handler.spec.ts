import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetPackageItemHandler } from "./package-detail.handler";
import type { IPackagesRepository } from "../packages.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetPackageItemHandler", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: GetPackageItemHandler;

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
    handler = new GetPackageItemHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should throw NotFoundError when group is not found", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);

    const mockRequest = {
      params: { groupSlug: "missing", packageSlug: "sub" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findPackageItemByGroupAndSlug).not.toHaveBeenCalled();
  });

  it("should throw NotFoundError when group is inactive", async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "core",
      name: "Core",
      isActive: false,
    });

    const mockRequest = {
      params: { groupSlug: "core", packageSlug: "sub" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });

  it("should throw NotFoundError when package item is not found", async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "core",
      name: "Core",
      isActive: true,
    });
    mockRepo.findPackageItemByGroupAndSlug.mockResolvedValue(null);

    const mockRequest = {
      params: { groupSlug: "core", packageSlug: "missing" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });

  it("should throw NotFoundError when package item is inactive", async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "core",
      name: "Core",
      isActive: true,
    });
    mockRepo.findPackageItemByGroupAndSlug.mockResolvedValue({
      id: "i-1",
      groupId: "g-1",
      slug: "sub",
      isActive: false,
    });

    const mockRequest = {
      params: { groupSlug: "core", packageSlug: "sub" },
    } as unknown as FastifyRequest<{ Params: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });

  it("should return mapped package item with groupSlug/groupName from the group", async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "core",
      name: "Core",
      isActive: true,
    });
    mockRepo.findPackageItemByGroupAndSlug.mockResolvedValue({
      id: "i-1",
      groupId: "g-1",
      slug: "sub",
      name: "Sub",
      description: "Sub pkg",
      nugetUrl: "https://nuget.org/sub",
      npmUrl: "https://npm.org/sub",
      githubUrl: "https://github.com/vefa/sub",
      latestVersion: "1.0.0",
      content: "Body",
      isActive: true,
    });

    const mockRequest = {
      params: { groupSlug: "core", packageSlug: "sub" },
    } as unknown as FastifyRequest<{ Params: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.findBySlug).toHaveBeenCalledWith("core");
    expect(mockRepo.findPackageItemByGroupAndSlug).toHaveBeenCalledWith("g-1", "sub");
    expect(result).toEqual({
      id: "i-1",
      groupId: "g-1",
      groupSlug: "core",
      groupName: "Core",
      slug: "sub",
      name: "Sub",
      description: "Sub pkg",
      nugetUrl: "https://nuget.org/sub",
      npmUrl: "https://npm.org/sub",
      githubUrl: "https://github.com/vefa/sub",
      latestVersion: "1.0.0",
      content: "Body",
    });
  });
});
