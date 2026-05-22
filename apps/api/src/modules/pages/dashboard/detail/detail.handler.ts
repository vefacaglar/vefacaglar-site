import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { NotFoundError } from "../../../../shared/http-errors";
import { PAGES_REPOSITORY } from "../../pages.tokens";
import type { IPagesRepository } from "../../pages.repository.interface";
import { GetAdminPageParams, GetAdminPageResponse } from "./detail.schema";

@injectable()
export class GetAdminPageHandler {
  constructor(@inject(PAGES_REPOSITORY) private readonly pagesRepo: IPagesRepository) {}

  async handle(request: FastifyRequest<{ Params: GetAdminPageParams }>): Promise<GetAdminPageResponse> {
    const page = await this.pagesRepo.findById(request.params.id);

    if (!page) {
      throw new NotFoundError("err_page_not_found");
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
