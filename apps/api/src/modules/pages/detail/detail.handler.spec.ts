import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetPageHandler } from "./detail.handler";
import type { IPagesRepository } from "../pages.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";

describe("GetPageHandler", () => {
  let mockRepo: Record<keyof IPagesRepository, any>;
  let handler: GetPageHandler;

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

    handler = new GetPageHandler(mockRepo as unknown as IPagesRepository);
  });

  it("should successfully retrieve and map published page details", async () => {
    const mockPage = {
      id: "page-1",
      slug: "about",
      title: "About Me",
      content: "This is about me content.",
      status: "published",
      seoTitle: "About Me SEO",
      seoDescription: "About Me SEO Description",
      publishedAt: new Date("2026-06-01T12:00:00.000Z"),
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T11:00:00.000Z"),
    };

    mockRepo.findBySlug.mockResolvedValue(mockPage);

    const mockRequest = {
      params: { slug: "about" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockRepo.findBySlug).toHaveBeenCalledWith("about");
    expect(result).toEqual({
      id: "page-1",
      slug: "about",
      title: "About Me",
      content: "This is about me content.",
      status: "published",
      seoTitle: "About Me SEO",
      seoDescription: "About Me SEO Description",
      publishedAt: "2026-06-01T12:00:00.000Z",
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T11:00:00.000Z",
    });
  });

  it("should throw NotFoundError if page is not found", async () => {
    mockRepo.findBySlug.mockResolvedValue(null);

    const mockRequest = {
      params: { slug: "non-existent" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findBySlug).toHaveBeenCalledWith("non-existent");
  });

  it("should throw NotFoundError if page is a draft", async () => {
    const mockDraftPage = {
      id: "page-2",
      slug: "draft-page",
      title: "Draft Page",
      status: "draft",
    };

    mockRepo.findBySlug.mockResolvedValue(mockDraftPage);

    const mockRequest = {
      params: { slug: "draft-page" },
    } as unknown as FastifyRequest<{ Params: { slug: string } }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow(NotFoundError);
    expect(mockRepo.findBySlug).toHaveBeenCalledWith("draft-page");
  });
});
