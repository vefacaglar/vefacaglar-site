import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListPagesHandler } from "./list.handler";
import type { IPagesRepository } from "../pages.repository.interface";
import { FastifyRequest } from "fastify";

describe("ListPagesHandler", () => {
  let mockRepo: Record<keyof IPagesRepository, any>;
  let handler: ListPagesHandler;

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
    handler = new ListPagesHandler(mockRepo as unknown as IPagesRepository);
  });

  it("should always pass status=published to the repository (public endpoint)", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0 });

    const mockRequest = {} as unknown as FastifyRequest<{ Querystring: any }>;

    await handler.handle(mockRequest);

    expect(mockRepo.list).toHaveBeenCalledWith({ status: "published" });
  });

  it("should map published pages to public response shape", async () => {
    mockRepo.list.mockResolvedValue({
      items: [
        {
          id: "page-1",
          slug: "about",
          title: "About",
          status: "published",
          seoTitle: "About SEO",
          seoDescription: "About SEO desc",
          publishedAt: new Date("2026-06-01T00:00:00.000Z"),
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          id: "page-2",
          slug: "now",
          title: "Now",
          status: "published",
          seoTitle: null,
          seoDescription: null,
          publishedAt: null,
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
          updatedAt: new Date("2026-05-02T00:00:00.000Z"),
        },
      ],
      total: 2,
    });

    const result = await handler.handle({} as unknown as FastifyRequest<{ Querystring: any }>);

    expect(result).toEqual([
      {
        id: "page-1",
        slug: "about",
        title: "About",
        status: "published",
        seoTitle: "About SEO",
        seoDescription: "About SEO desc",
        publishedAt: "2026-06-01T00:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "page-2",
        slug: "now",
        title: "Now",
        status: "published",
        seoTitle: null,
        seoDescription: null,
        publishedAt: null,
        createdAt: "2026-05-02T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      },
    ]);
  });
});
