import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteProjectHandler } from "./delete.handler";
import type { IProjectsRepository } from "../../projects.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("DeleteProjectHandler", () => {
  let mockRepo: Record<keyof IProjectsRepository, any>;
  let handler: DeleteProjectHandler;

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
    handler = new DeleteProjectHandler(mockRepo as unknown as IProjectsRepository);
  });

  it("should delete the existing project and return success", async () => {
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

  it("should throw NotFoundError and skip delete when project does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });
});
