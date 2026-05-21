import { FastifyRequest } from "fastify";
import { UpdatePageParams, UpdatePageRequest, UpdatePageResponse } from "./update.schema";
import { PagesRepository } from "../pages.repository";

export class UpdatePageHandler {
  constructor(private readonly pagesRepo: PagesRepository) {}

  async handle(
    request: FastifyRequest<{ Params: UpdatePageParams; Body: UpdatePageRequest }>
  ): Promise<UpdatePageResponse> {
    const { id } = request.params;
    const { title, slug, content, status, seoTitle, seoDescription } = request.body;

    const existingPage = await this.pagesRepo.findById(id);

    if (!existingPage) {
      throw new Error("PageNotFound");
    }

    let publishedAt = existingPage.publishedAt;
    if (status === "published" && !existingPage.publishedAt) {
      publishedAt = new Date();
    } else if (status === "draft") {
      publishedAt = null;
    }

    const updatedPage = await this.pagesRepo.update(id, {
      title,
      slug,
      content,
      status,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      publishedAt,
      updatedAt: new Date(),
    });

    return {
      id: updatedPage.id,
      slug: updatedPage.slug,
      title: updatedPage.title,
      content: updatedPage.content,
      status: updatedPage.status as "draft" | "published",
      seoTitle: updatedPage.seoTitle,
      seoDescription: updatedPage.seoDescription,
      publishedAt: updatedPage.publishedAt ? updatedPage.publishedAt.toISOString() : null,
      createdAt: updatedPage.createdAt.toISOString(),
      updatedAt: updatedPage.updatedAt.toISOString(),
    };
  }
}
