import { FastifyRequest } from "fastify";
import { GetPostParams, GetPostResponse } from "./detail.schema";
import { AuthService } from "../../auth/auth.service";
import { PostsRepository } from "../posts.repository";

export class GetPostHandler {
  constructor(
    private readonly postsRepo: PostsRepository,
    private readonly auth: AuthService
  ) {}

  async handle(request: FastifyRequest<{ Params: GetPostParams }>): Promise<GetPostResponse> {
    const { slug } = request.params;

    const post = await this.postsRepo.findBySlugWithAuthor(slug);

    if (!post) {
      throw new Error("PostNotFound");
    }

    if (post.status === "draft") {
      let isAdmin = false;
      try {
        const { user } = await this.auth.authenticate(request);
        if (user.role === "admin") {
          isAdmin = true;
        }
      } catch {
        // Not authenticated or not admin
      }

      if (!isAdmin) {
        throw new Error("PostNotFound"); // Hide drafts from public
      }
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
