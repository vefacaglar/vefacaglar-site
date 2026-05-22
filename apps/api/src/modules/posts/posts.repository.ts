import { posts, users, localizations } from "@vefacaglar/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IPostsRepository } from "./posts.repository.interface";
import { mergeTranslations, LanguageProvider } from "../../shared/localization";

export type Post = InferSelectModel<typeof posts>;
export type NewPost = InferInsertModel<typeof posts>;

export type PostWithAuthor = Post & {
  authorUsername: string | null;
  authorDisplayName: string | null;
};

@injectable()
export class DrizzlePostsRepository implements IPostsRepository {
  constructor(
    private readonly dbProvider: DbProvider,
    private readonly langProvider: LanguageProvider
  ) {}

  async create(values: NewPost): Promise<Post> {
    const [row] = await this.dbProvider.client.insert(posts).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Post | null> {
    const [row] = await this.dbProvider.client.select().from(posts).where(eq(posts.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlugWithAuthor(slug: string): Promise<PostWithAuthor | null> {
    const lang = this.langProvider.getLanguage();
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

    if (!row || !lang || lang === 'en') return row ?? null;

    const translations = await this.dbProvider.client
      .select({ field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'post'),
        eq(localizations.entityId, row.id),
        eq(localizations.languageCode, lang)
      ));

    return mergeTranslations(row, translations);
  }

  async listWithAuthor(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: PostWithAuthor[]; total: number }> {
    const lang = this.langProvider.getLanguage();
    const { items: rows, total } = await this.listRawWithAuthor(filter);

    if (rows.length === 0 || !lang || lang === 'en') return { items: rows, total };

    const ids = rows.map((r) => r.id);
    const allTranslations = await this.dbProvider.client
      .select({ entityId: localizations.entityId, field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'post'),
        inArray(localizations.entityId, ids),
        eq(localizations.languageCode, lang)
      ));

    const translationsMap: Record<string, { field: string; value: string }[]> = {};
    for (const trans of allTranslations) {
      if (!translationsMap[trans.entityId]) {
        translationsMap[trans.entityId] = [];
      }
      translationsMap[trans.entityId].push(trans);
    }

    const translatedItems = rows.map((row) => {
      const postTranslations = translationsMap[row.id] || [];
      return mergeTranslations(row, postTranslations);
    });

    return { items: translatedItems, total };
  }

  async listRawWithAuthor(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: PostWithAuthor[]; total: number }> {
    const conditions = filter?.status ? [eq(posts.status, filter.status)] : [];

    const [countResult] = await this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult?.count || 0);

    let query = this.dbProvider.client
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
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
      .$dynamic();

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      query = query.limit(filter.limit).offset(offset);
    }

    const items = await query;
    return { items, total };
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
    const lang = this.langProvider.getLanguage();
    const rows = await this.dbProvider.client
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

    if (rows.length === 0 || !lang || lang === 'en') return rows;

    const ids = rows.map((r) => r.id);
    const allTranslations = await this.dbProvider.client
      .select({ entityId: localizations.entityId, field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'post'),
        inArray(localizations.entityId, ids),
        eq(localizations.languageCode, lang)
      ));

    const translationsMap: Record<string, { field: string; value: string }[]> = {};
    for (const trans of allTranslations) {
      if (!translationsMap[trans.entityId]) {
        translationsMap[trans.entityId] = [];
      }
      translationsMap[trans.entityId].push(trans);
    }

    return rows.map((row) => {
      const postTranslations = translationsMap[row.id] || [];
      return mergeTranslations(row, postTranslations);
    });
  }
}
