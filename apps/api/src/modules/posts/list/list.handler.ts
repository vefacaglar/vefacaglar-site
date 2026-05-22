import { FastifyRequest } from "fastify";
import { ListPostsQuery, ListPostsResponse } from "./list.schema";
import { injectable, inject } from "tsyringe";
import { POSTS_REPOSITORY } from "../posts.tokens";
import type { IPostsRepository } from "../posts.repository.interface";

@injectable()
export class ListPostsHandler {
  constructor(@inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListPostsQuery }>): Promise<ListPostsResponse> {
    const isAdmin = request.user?.role === "admin";
    const { status } = request.query;

    const filter = !isAdmin
      ? { status: "published" as const }
      : status
      ? { status }
      : undefined;

    const rows = await this.postsRepo.listWithAuthor(filter, request.lang);

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
