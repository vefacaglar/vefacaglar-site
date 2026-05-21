import { FastifyRequest } from "fastify";
import { CreatePostRequest, PostResponse } from "./create.schema";
import { PostsRepository } from "../posts.repository";

export class CreatePostHandler {
  constructor(private readonly postsRepo: PostsRepository) {}

  async handle(request: FastifyRequest<{ Body: CreatePostRequest }>): Promise<PostResponse> {
    const user = request.user!;

    const { title, slug, excerpt, content, status, coverImageUrl, seoTitle, seoDescription } = request.body;

    const publishedAt = status === "published" ? new Date() : null;

    const newPost = await this.postsRepo.create({
      title,
      slug,
      excerpt: excerpt || null,
      content,
      status,
      coverImageUrl: coverImageUrl || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      publishedAt,
      authorId: user.id,
    });

    return {
      id: newPost.id,
      slug: newPost.slug,
      title: newPost.title,
      excerpt: newPost.excerpt,
      content: newPost.content,
      status: newPost.status as "draft" | "published",
      coverImageUrl: newPost.coverImageUrl,
      seoTitle: newPost.seoTitle,
      seoDescription: newPost.seoDescription,
      publishedAt: newPost.publishedAt ? newPost.publishedAt.toISOString() : null,
      createdAt: newPost.createdAt.toISOString(),
      updatedAt: newPost.updatedAt.toISOString(),
      author: {
        username: user.username,
        displayName: user.displayName,
      },
    };
  }
}
