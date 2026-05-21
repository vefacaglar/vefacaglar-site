import { FastifyRequest } from "fastify";
import { ListPagesQuery, ListPagesResponse } from "./list.schema";
import { PagesRepository } from "../pages.repository";

export class ListPagesHandler {
  constructor(private readonly pagesRepo: PagesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListPagesQuery }>): Promise<ListPagesResponse> {
    const isAdmin = request.user?.role === "admin";
    const { status } = request.query;

    const filter = !isAdmin
      ? { status: "published" as const }
      : status
      ? { status }
      : undefined;

    const result = await this.pagesRepo.list(filter);

    return result.map((page) => ({
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
