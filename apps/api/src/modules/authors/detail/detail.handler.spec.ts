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

  describe("author visibility (real service, mocked repositories)", () => {
    let usersRepo: Record<string, any>;
    let postsRepo: Record<string, any>;
    const request = { params: { username: "someone" } } as unknown as FastifyRequest<{
      Params: { username: string };
    }>;

    beforeEach(() => {
      usersRepo = { findByUsername: vi.fn() };
      postsRepo = { listPublishedByAuthorId: vi.fn().mockResolvedValue([]) };
      handler = new GetAuthorHandler(new AuthorsService(usersRepo as any, postsRepo as any));
    });

    it("hides regular members without published posts", async () => {
      usersRepo.findByUsername.mockResolvedValue({ id: "u-1", username: "someone", displayName: "x", role: "user", isActive: true });

      await expect(handler.handle(request)).rejects.toThrow(NotFoundError);
    });

    it("hides disabled accounts", async () => {
      usersRepo.findByUsername.mockResolvedValue({ id: "u-1", username: "someone", displayName: "x", role: "admin", isActive: false });

      await expect(handler.handle(request)).rejects.toThrow(NotFoundError);
    });

    it("shows active admins even without posts", async () => {
      usersRepo.findByUsername.mockResolvedValue({ id: "u-1", username: "someone", displayName: "Admin", role: "admin", isActive: true });

      const result = await handler.handle(request);

      expect(result).toEqual({ username: "someone", displayName: "Admin", posts: [] });
    });
  });
});
