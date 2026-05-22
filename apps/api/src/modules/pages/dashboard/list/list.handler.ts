import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PAGES_REPOSITORY } from "../../pages.tokens";
import type { IPagesRepository } from "../../pages.repository.interface";
import { ListAdminPagesQuery, ListAdminPagesResponse } from "./list.schema";

@injectable()
export class ListAdminPagesHandler {
  constructor(@inject(PAGES_REPOSITORY) private readonly pagesRepo: IPagesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListAdminPagesQuery }>): Promise<ListAdminPagesResponse> {
    const { status } = request.query;
    const rows = await this.pagesRepo.listRaw(status ? { status } : undefined);

    return rows.map((page) => ({
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
    }));
  }
}
