import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeletePackageHandler } from "./delete.handler";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("DeletePackageHandler", () => {
  let mockRepo: Record<keyof IPackagesRepository, any>;
  let handler: DeletePackageHandler;

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
    handler = new DeletePackageHandler(mockRepo as unknown as IPackagesRepository);
  });

  it("should delete the package and return success", async () => {
    mockRepo.findById.mockResolvedValue({ id: "p-1" });
    mockRepo.delete.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "p-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.findById).toHaveBeenCalledWith("p-1");
    expect(mockRepo.delete).toHaveBeenCalledWith("p-1");
    expect(result).toEqual({ success: true });
  });

  it("should throw NotFoundError when package does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });
});
