import { FastifyRequest } from "fastify";
import { db, posts } from "@vefacaglar/db";
import { eq, and, desc } from "drizzle-orm";
import { ListPostsQuery, ListPostsResponse } from "./list.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class ListPostsHandler {
  async handle(request: FastifyRequest<{ Querystring: ListPostsQuery }>): Promise<ListPostsResponse> {
    let isAdmin = false;

    try {
      const { user } = await authenticateRequest(request);
      if (user.role === "admin") {
        isAdmin = true;
      }
    } catch {
      // Ignore authentication errors for listing, fall back to public view
    }

    const { status } = request.query;

    let conditions = [];

    if (!isAdmin) {
      // Non-admins can only see published posts
      conditions.push(eq(posts.status, "published"));
    } else if (status) {
      // Admins can filter by draft or published if query param is passed
      conditions.push(eq(posts.status, status));
    }

    const query = db
      .select()
      .from(posts)
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt));

    const result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return result.map((post) => ({
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
    }));
  }
}
