import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeletePostHandler } from "./delete.handler";
import type { IPostsRepository } from "../../posts.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("DeletePostHandler", () => {
  let mockRepo: Record<keyof IPostsRepository, any>;
  let handler: DeletePostHandler;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlugWithAuthor: vi.fn(),
      listWithAuthor: vi.fn(),
      listRawWithAuthor: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listPublishedByAuthorId: vi.fn(),
    };
    handler = new DeletePostHandler(mockRepo as unknown as IPostsRepository);
  });

  it("should delete the existing post and return success", async () => {
    mockRepo.findById.mockResolvedValue({ id: "post-1" });
    mockRepo.delete.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "post-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.findById).toHaveBeenCalledWith("post-1");
    expect(mockRepo.delete).toHaveBeenCalledWith("post-1");
    expect(result).toEqual({ success: true });
  });

  it("should throw NotFoundError when post does not exist (skipping delete)", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockRequest = {
      params: { id: "missing" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });
});
