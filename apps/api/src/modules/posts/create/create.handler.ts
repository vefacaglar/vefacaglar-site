import { FastifyRequest } from "fastify";
import { db, posts } from "@vefacaglar/db";
import { CreatePostRequest, PostResponse } from "./create.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class CreatePostHandler {
  async handle(request: FastifyRequest<{ Body: CreatePostRequest }>): Promise<PostResponse> {
    const { user } = await authenticateRequest(request);

    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { title, slug, excerpt, content, status, coverImageUrl, seoTitle, seoDescription } = request.body;

    const publishedAt = status === "published" ? new Date() : null;

    const [newPost] = await db
      .insert(posts)
      .values({
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
      })
      .returning();

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
