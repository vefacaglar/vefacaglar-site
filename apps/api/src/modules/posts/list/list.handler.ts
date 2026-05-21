import { FastifyRequest } from "fastify";
import { db, posts, users } from "@vefacaglar/db";
import { eq, and, desc, isNotNull, sql } from "drizzle-orm";
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

    const result = await db
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt));

    return result.map((row) => ({
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
