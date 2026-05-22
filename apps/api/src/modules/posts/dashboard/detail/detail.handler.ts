import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { NotFoundError } from "../../../../shared/http-errors";
import { POSTS_REPOSITORY } from "../../posts.tokens";
import type { IPostsRepository } from "../../posts.repository.interface";
import { GetAdminPostParams, GetAdminPostResponse } from "./detail.schema";

@injectable()
export class GetAdminPostHandler {
  constructor(@inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository) {}

  async handle(request: FastifyRequest<{ Params: GetAdminPostParams }>): Promise<GetAdminPostResponse> {
    const post = await this.postsRepo.findById(request.params.id);

    if (!post) {
      throw new NotFoundError("err_post_not_found");
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
      author: null,
    };
  }
}
