import { FastifyRequest } from "fastify";
import { CreatePageRequest, PageResponse } from "./create.schema";
import { PagesRepository } from "../pages.repository";

export class CreatePageHandler {
  constructor(private readonly pagesRepo: PagesRepository) {}

  async handle(request: FastifyRequest<{ Body: CreatePageRequest }>): Promise<PageResponse> {
    const { title, slug, content, status, seoTitle, seoDescription } = request.body;

    const publishedAt = status === "published" ? new Date() : null;

    const newPage = await this.pagesRepo.create({
      title,
      slug,
      content,
      status,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      publishedAt,
    });

    return {
      id: newPage.id,
      slug: newPage.slug,
      title: newPage.title,
      content: newPage.content,
      status: newPage.status as "draft" | "published",
      seoTitle: newPage.seoTitle,
      seoDescription: newPage.seoDescription,
      publishedAt: newPage.publishedAt ? newPage.publishedAt.toISOString() : null,
      createdAt: newPage.createdAt.toISOString(),
      updatedAt: newPage.updatedAt.toISOString(),
    };
  }
}
