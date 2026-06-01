import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateProjectHandler } from "./create.handler";
import type { IProjectsRepository } from "../../projects.repository.interface";
import { FastifyRequest } from "fastify";

describe("CreateProjectHandler", () => {
  let mockRepo: Record<keyof IProjectsRepository, any>;
  let handler: CreateProjectHandler;

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
    handler = new CreateProjectHandler(mockRepo as unknown as IProjectsRepository);
  });

  it("should create a published project with timestamps and featured/sortOrder flags", async () => {
    const createdAt = new Date("2026-06-01T09:00:00.000Z");
    const updatedAt = new Date("2026-06-01T09:00:00.000Z");
    const publishedAt = new Date("2026-06-01T09:05:00.000Z");

    mockRepo.create.mockResolvedValue({
      id: "p-1",
      slug: "cool",
      title: "Cool",
      summary: "Sum",
      content: "Body",
      status: "published",
      featured: true,
      sortOrder: 5,
      githubUrl: "https://github.com/vefa/cool",
      liveUrl: "https://cool.vefa.dev",
      coverImageUrl: "https://cdn.example.com/c.png",
      seoTitle: "SEO",
      seoDescription: "SEOd",
      startedAt: "2026-01-01",
      endedAt: "2026-02-01",
      publishedAt,
      createdAt,
      updatedAt,
    });

    const mockRequest = {
      body: {
        title: "Cool",
        slug: "cool",
        summary: "Sum",
        content: "Body",
        status: "published" as const,
        featured: true,
        sortOrder: 5,
        githubUrl: "https://github.com/vefa/cool",
        liveUrl: "https://cool.vefa.dev",
        coverImageUrl: "https://cdn.example.com/c.png",
        seoTitle: "SEO",
        seoDescription: "SEOd",
        startedAt: "2026-01-01",
        endedAt: "2026-02-01",
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.featured).toBe(true);
    expect(createArg.sortOrder).toBe(5);
    expect(createArg.publishedAt).toBeInstanceOf(Date);
    expect(result.publishedAt).toBe(publishedAt.toISOString());
    expect(result.featured).toBe(true);
    expect(result.sortOrder).toBe(5);
  });

  it("should default featured to false and sortOrder to 0 when not provided", async () => {
    mockRepo.create.mockResolvedValue({
      id: "p-2",
      slug: "x",
      title: "X",
      summary: "S",
      content: "C",
      status: "draft",
      featured: false,
      sortOrder: 0,
      githubUrl: null,
      liveUrl: null,
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      startedAt: null,
      endedAt: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      body: {
        title: "X",
        slug: "x",
        summary: "S",
        content: "C",
        status: "draft" as const,
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.featured).toBe(false);
    expect(createArg.sortOrder).toBe(0);
    expect(createArg.publishedAt).toBeNull();
    expect(createArg.githubUrl).toBeNull();
    expect(createArg.startedAt).toBeNull();
  });

  it("should convert empty string optional fields to null", async () => {
    mockRepo.create.mockResolvedValue({
      id: "p-3",
      slug: "x",
      title: "X",
      summary: "S",
      content: "C",
      status: "draft",
      featured: false,
      sortOrder: 0,
      githubUrl: null,
      liveUrl: null,
      coverImageUrl: null,
      seoTitle: null,
      seoDescription: null,
      startedAt: null,
      endedAt: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      body: {
        title: "X",
        slug: "x",
        summary: "S",
        content: "C",
        status: "draft" as const,
        githubUrl: "",
        liveUrl: "",
        coverImageUrl: "",
        seoTitle: "",
        seoDescription: "",
        startedAt: "",
        endedAt: "",
      },
    } as unknown as FastifyRequest<{ Body: any }>;

    await handler.handle(mockRequest);

    const createArg = mockRepo.create.mock.calls[0][0];
    expect(createArg.githubUrl).toBeNull();
    expect(createArg.liveUrl).toBeNull();
    expect(createArg.coverImageUrl).toBeNull();
    expect(createArg.seoTitle).toBeNull();
    expect(createArg.seoDescription).toBeNull();
    expect(createArg.startedAt).toBeNull();
    expect(createArg.endedAt).toBeNull();
  });
});
