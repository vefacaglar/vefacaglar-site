import { FastifyRequest } from "fastify";
import { CreatePageRequest, PageResponse } from "./create.schema";
import { injectable, inject } from "tsyringe";
import { PAGES_REPOSITORY } from "../pages.tokens";
import type { IPagesRepository } from "../pages.repository.interface";

@injectable()
export class CreatePageHandler {
  constructor(@inject(PAGES_REPOSITORY) private readonly pagesRepo: IPagesRepository) {}

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
