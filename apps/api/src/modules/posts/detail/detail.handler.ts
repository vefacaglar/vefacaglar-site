import { FastifyRequest } from "fastify";
import { GetPostParams, GetPostResponse } from "./detail.schema";
import { injectable, inject } from "tsyringe";
import { POSTS_REPOSITORY } from "../posts.tokens";
import type { IPostsRepository } from "../posts.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";

@injectable()
export class GetPostHandler {
  constructor(@inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository) {}

  async handle(request: FastifyRequest<{ Params: GetPostParams }>): Promise<GetPostResponse> {
    const { slug } = request.params;

    const post = await this.postsRepo.findBySlugWithAuthor(slug);

    if (!post) {
      throw new NotFoundError("Post not found.");
    }

    // Hide drafts from non-admins
    if (post.status === "draft" && request.user?.role !== "admin") {
      throw new NotFoundError("Post not found.");
    }

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      status: post.status as "draft" | "published",
      coverImageUrl: post.coverImageUrl,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      author: post.authorUsername && post.authorDisplayName
        ? { username: post.authorUsername, displayName: post.authorDisplayName }
        : null,
    };
  }
}
