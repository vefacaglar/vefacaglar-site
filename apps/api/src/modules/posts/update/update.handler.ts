import { FastifyRequest } from "fastify";
import { db, posts, users } from "@vefacaglar/db";
import { eq } from "drizzle-orm";
import { UpdatePostParams, UpdatePostRequest, UpdatePostResponse } from "./update.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class UpdatePostHandler {
  async handle(
    request: FastifyRequest<{ Params: UpdatePostParams; Body: UpdatePostRequest }>
  ): Promise<UpdatePostResponse> {
    const { user } = await authenticateRequest(request);

    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { id } = request.params;
    const { title, slug, excerpt, content, status, coverImageUrl, seoTitle, seoDescription } = request.body;

    const [existingPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);

    if (!existingPost) {
      throw new Error("PostNotFound");
    }

    let publishedAt = existingPost.publishedAt;
    if (status === "published" && !existingPost.publishedAt) {
      publishedAt = new Date();
    } else if (status === "draft") {
      publishedAt = null;
    }

    const [updatedPost] = await db
      .update(posts)
      .set({
        title,
        slug,
        excerpt: excerpt || null,
        content,
        status,
        coverImageUrl: coverImageUrl || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id))
      .returning();

    return {
      id: updatedPost.id,
      slug: updatedPost.slug,
      title: updatedPost.title,
      excerpt: updatedPost.excerpt,
      content: updatedPost.content,
      status: updatedPost.status as "draft" | "published",
      coverImageUrl: updatedPost.coverImageUrl,
      seoTitle: updatedPost.seoTitle,
      seoDescription: updatedPost.seoDescription,
      publishedAt: updatedPost.publishedAt ? updatedPost.publishedAt.toISOString() : null,
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
      author: {
        username: user.username,
        displayName: user.displayName,
      },
    };
  }
}
