import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreatePageHandler } from "./create.handler";
import type { IPagesRepository } from "../../pages.repository.interface";
import { FastifyRequest } from "fastify";

describe("CreatePageHandler", () => {
  let mockRepo: Record<keyof IPagesRepository, any>;
  let handler: CreatePageHandler;

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
    handler = new CreatePageHandler(mockRepo as unknown as IPagesRepository);
  });

  it("should create a published page with publishedAt timestamp", async () => {
    mockRepo.create.mockResolvedValue({
      id: "page-1",
      slug: "about",
      title: "About",
      content: "Body",
      status: "published",
      seoTitle: "SEO",
      seoDescription: "SEOd",
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    const mockRequest = {
      body: {
        title: "About",
        slug: "about",
        content: "Body",
        status: "published" as const,
        seoTitle: "SEO",
        seoDescription: "SEOd",
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.publishedAt).toBeInstanceOf(Date);
    expect(result.publishedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("should create a draft page with null publishedAt and null SEO fields when missing", async () => {
    mockRepo.create.mockResolvedValue({
      id: "page-2",
      slug: "draft",
      title: "Draft",
      content: "Body",
      status: "draft",
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      body: {
        title: "Draft",
        slug: "draft",
        content: "Body",
        status: "draft" as const,
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.publishedAt).toBeNull();
    expect(createArg.seoTitle).toBeNull();
    expect(createArg.seoDescription).toBeNull();
    expect(result.publishedAt).toBeNull();
  });

  it("should normalize empty string SEO fields to null", async () => {
    mockRepo.create.mockResolvedValue({
      id: "page-3",
      slug: "x",
      title: "X",
      content: "C",
      status: "draft",
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      body: {
        title: "X",
        slug: "x",
        content: "C",
        status: "draft" as const,
        seoTitle: "",
        seoDescription: "",
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.seoTitle).toBeNull();
    expect(createArg.seoDescription).toBeNull();
  });
});
