import { FastifyRequest } from "fastify";
import { ListPostsQuery, ListPostsResponse } from "./list.schema";
import { injectable, inject } from "tsyringe";
import { POSTS_REPOSITORY } from "../posts.tokens";
import type { IPostsRepository } from "../posts.repository.interface";

@injectable()
export class ListPostsHandler {
  constructor(@inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListPostsQuery }>): Promise<ListPostsResponse> {
    const { page, limit } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 10;

    const filter = {
      status: "published" as const,
      page: pageNum,
      limit: limitNum,
    };

    const { items: rows, total } = await this.postsRepo.listWithAuthor(filter);
    const totalPages = Math.ceil(total / limitNum);

    const items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      status: row.status as "draft" | "published",
      coverImageUrl: row.coverImageUrl,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author: row.authorUsername && row.authorDisplayName
        ? { username: row.authorUsername, displayName: row.authorDisplayName }
        : null,
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
