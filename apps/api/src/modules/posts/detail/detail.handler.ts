import { FastifyRequest } from "fastify";
import { db, posts, users } from "@vefacaglar/db";
import { eq, sql } from "drizzle-orm";
import { GetPostParams, GetPostResponse } from "./detail.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class GetPostHandler {
  async handle(request: FastifyRequest<{ Params: GetPostParams }>): Promise<GetPostResponse> {
    const { slug } = request.params;

    const [post] = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        content: posts.content,
        status: posts.status,
        coverImageUrl: posts.coverImageUrl,
        seoTitle: posts.seoTitle,
        seoDescription: posts.seoDescription,
        publishedAt: posts.publishedAt,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
      })
      .from(posts)
      .leftJoin(users, sql`${posts.authorId} = ${users.id}`)
      .where(eq(posts.slug, slug))
      .limit(1);

    if (!post) {
      throw new Error("PostNotFound");
    }

    if (post.status === "draft") {
      let isAdmin = false;
      try {
        const { user } = await authenticateRequest(request);
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
