import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetAuthorHandler } from "./detail.handler";
import { AuthorsService } from "../authors.service";
import { NotFoundError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetAuthorHandler", () => {
  let mockService: Record<string, any>;
  let handler: GetAuthorHandler;

  beforeEach(() => {
    mockService = { getByUsername: vi.fn() };
    handler = new GetAuthorHandler(mockService as unknown as AuthorsService);
  });

  it("should pass username from params to service and return its result", async () => {
    mockService.getByUsername.mockResolvedValue({
      username: "vefa",
      displayName: "Vefa Çağlar",
      posts: [
        {
          id: "p-1",
          slug: "hello",
          title: "Hello",
          excerpt: "Excerpt",
          publishedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    });

    const mockRequest = {
      params: { username: "vefa" },
    } as unknown as FastifyRequest<{ Params: { username: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockService.getByUsername).toHaveBeenCalledWith("vefa");
    expect(result.username).toBe("vefa");
    expect(result.posts).toHaveLength(1);
  });

  it("should propagate NotFoundError from service", async () => {
    mockService.getByUsername.mockRejectedValue(new NotFoundError("Author not found."));

    const mockRequest = {
      params: { username: "missing" },
    } as unknown as FastifyRequest<{ Params: { username: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
  });
});
