import { FastifyRequest } from "fastify";
import { GetPageParams, GetPageResponse } from "./detail.schema";
import { PagesRepository } from "../pages.repository";
import { NotFoundError } from "../../../shared/http-errors";

export class GetPageHandler {
  constructor(private readonly pagesRepo: PagesRepository) {}

  async handle(request: FastifyRequest<{ Params: GetPageParams }>): Promise<GetPageResponse> {
    const { slug } = request.params;

    const page = await this.pagesRepo.findBySlug(slug);

    if (!page) {
      throw new NotFoundError("Page not found.");
    }

    if (page.status === "draft" && request.user?.role !== "admin") {
      throw new NotFoundError("Page not found.");
    }

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      status: page.status as "draft" | "published",
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    };
  }
}
