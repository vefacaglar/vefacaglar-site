import { FastifyRequest } from "fastify";
import { db, posts, users } from "@vefacaglar/db";
import { eq, and, sql } from "drizzle-orm";
import { GetAuthorParams, GetAuthorResponse } from "./detail.schema";

export class GetAuthorHandler {
  async handle(request: FastifyRequest<{ Params: GetAuthorParams }>): Promise<GetAuthorResponse> {
    const { username } = request.params;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new Error("AuthorNotFound");
    }

    const authorPosts = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(
        and(
          sql`${posts.authorId} = ${user.id}`,
          eq(posts.status, "published")
        )
      )
      .orderBy(posts.publishedAt, posts.createdAt);

    return {
      username: user.username,
      displayName: user.displayName,
      posts: authorPosts.map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      })),
    };
  }
}
