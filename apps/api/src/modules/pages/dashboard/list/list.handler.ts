import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PAGES_REPOSITORY } from "../../pages.tokens";
import type { IPagesRepository } from "../../pages.repository.interface";
import { ListAdminPagesQuery, ListAdminPagesResponse } from "./list.schema";

@injectable()
export class ListAdminPagesHandler {
  constructor(@inject(PAGES_REPOSITORY) private readonly pagesRepo: IPagesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListAdminPagesQuery }>): Promise<ListAdminPagesResponse> {
    const { status, page, limit } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 5;

    const { items: rows, total } = await this.pagesRepo.listRaw({
      status: status ? status : undefined,
      page: pageNum,
      limit: limitNum,
    });

    const totalPages = Math.ceil(total / limitNum);

    const items = rows.map((page) => ({
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

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };
  }
}
