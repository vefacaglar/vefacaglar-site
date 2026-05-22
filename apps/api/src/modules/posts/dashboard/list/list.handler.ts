import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { POSTS_REPOSITORY } from "../../posts.tokens";
import type { IPostsRepository } from "../../posts.repository.interface";
import { ListAdminPostsQuery, ListAdminPostsResponse } from "./list.schema";

@injectable()
export class ListAdminPostsHandler {
  constructor(@inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListAdminPostsQuery }>): Promise<ListAdminPostsResponse> {
    const { status } = request.query;
    const { items: rows } = await this.postsRepo.listRawWithAuthor(status ? { status } : undefined);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      content: row.content,
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
  }
}
