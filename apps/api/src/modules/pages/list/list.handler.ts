import { FastifyRequest } from "fastify";
import { ListPagesQuery, ListPagesResponse } from "./list.schema";
import { injectable, inject } from "tsyringe";
import { PAGES_REPOSITORY } from "../pages.tokens";
import type { IPagesRepository } from "../pages.repository.interface";

@injectable()
export class ListPagesHandler {
  constructor(@inject(PAGES_REPOSITORY) private readonly pagesRepo: IPagesRepository) {}

  async handle(_request: FastifyRequest<{ Querystring: ListPagesQuery }>): Promise<ListPagesResponse> {
    const { items: result } = await this.pagesRepo.list({ status: "published" });

    return result.map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      status: page.status as "draft" | "published",
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    }));
  }
}
