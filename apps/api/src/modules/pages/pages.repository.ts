import { pages } from "@vefacaglar/db";
import type { DbType } from "@vefacaglar/db";
import { and, desc, eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable, inject } from "tsyringe";
import { DB_CONNECTION } from "../../db.tokens";
import type { IPagesRepository } from "./pages.repository.interface";

export type Page = InferSelectModel<typeof pages>;
export type NewPage = InferInsertModel<typeof pages>;

@injectable()
export class DrizzlePagesRepository implements IPagesRepository {
  constructor(@inject(DB_CONNECTION) private readonly db: DbType) {}

  async create(values: NewPage): Promise<Page> {
    const [row] = await this.db.insert(pages).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Page | null> {
    const [row] = await this.db.select().from(pages).where(eq(pages.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Page | null> {
    const [row] = await this.db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    return row ?? null;
  }

  async list(filter?: { status?: "draft" | "published" }): Promise<Page[]> {
    const conditions = filter?.status ? [eq(pages.status, filter.status)] : [];

    return await this.db
      .select()
      .from(pages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pages.publishedAt), desc(pages.createdAt));
  }

  async update(id: string, patch: Partial<NewPage>): Promise<Page> {
    const [row] = await this.db.update(pages).set(patch).where(eq(pages.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(pages).where(eq(pages.id, id));
  }
}
