import { posts, users } from "@vefacaglar/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IPostsRepository } from "./posts.repository.interface";

export type Post = InferSelectModel<typeof posts>;
export type NewPost = InferInsertModel<typeof posts>;

export type PostWithAuthor = Post & {
  authorUsername: string | null;
  authorDisplayName: string | null;
};

@injectable()
export class DrizzlePostsRepository implements IPostsRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewPost): Promise<Post> {
    const [row] = await this.dbProvider.client.insert(posts).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Post | null> {
    const [row] = await this.dbProvider.client.select().from(posts).where(eq(posts.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlugWithAuthor(slug: string): Promise<PostWithAuthor | null> {
    const [row] = await this.dbProvider.client
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
        authorId: posts.authorId,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async listWithAuthor(filter?: { status?: "draft" | "published" }): Promise<PostWithAuthor[]> {
    const conditions = filter?.status ? [eq(posts.status, filter.status)] : [];

    return await this.dbProvider.client
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
        authorId: posts.authorId,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt));
  }

  async update(id: string, patch: Partial<NewPost>): Promise<Post> {
    const [row] = await this.dbProvider.client.update(posts).set(patch).where(eq(posts.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(posts).where(eq(posts.id, id));
  }

  async listPublishedByAuthorId(
    authorId: string
  ): Promise<Pick<Post, "id" | "slug" | "title" | "excerpt" | "publishedAt">[]> {
    return await this.dbProvider.client
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(and(sql`${posts.authorId} = ${authorId}`, eq(posts.status, "published")))
      .orderBy(posts.publishedAt, posts.createdAt);
  }
}
