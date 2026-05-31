import { pages, localizations } from "@vefacaglar/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IPagesRepository } from "./pages.repository.interface";
import { mergeTranslations, groupTranslationsByEntity, LanguageProvider } from "../../shared/localization";

export type Page = InferSelectModel<typeof pages>;
export type NewPage = InferInsertModel<typeof pages>;

@injectable()
export class DrizzlePagesRepository implements IPagesRepository {
  constructor(
    private readonly dbProvider: DbProvider,
    private readonly langProvider: LanguageProvider
  ) {}

  async create(values: NewPage): Promise<Page> {
    const [row] = await this.dbProvider.client.insert(pages).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Page | null> {
    const [row] = await this.dbProvider.client.select().from(pages).where(eq(pages.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Page | null> {
    const lang = this.langProvider.getLanguage();
    const [row] = await this.dbProvider.client.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    if (!row || !lang || lang === 'en') return row ?? null;

    const translations = await this.dbProvider.client
      .select({ field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'page'),
        eq(localizations.entityId, row.id),
        eq(localizations.languageCode, lang)
      ));

    return mergeTranslations(row, translations);
  }

  async list(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: Page[]; total: number }> {
    const lang = this.langProvider.getLanguage();
    const { items: rows, total } = await this.listRaw(filter);

    if (rows.length === 0 || !lang || lang === 'en') return { items: rows, total };

    const ids = rows.map((r) => r.id);
    const allTranslations = await this.dbProvider.client
      .select({ entityId: localizations.entityId, field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'page'),
        inArray(localizations.entityId, ids),
        eq(localizations.languageCode, lang)
      ));

    const translationsMap = groupTranslationsByEntity(allTranslations);

    const translatedItems = rows.map((row) =>
      mergeTranslations(row, translationsMap[row.id] ?? [])
    );

    return { items: translatedItems, total };
  }

  async listRaw(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: Page[]; total: number }> {
    const conditions = filter?.status ? [eq(pages.status, filter.status)] : [];

    const [countResult] = await this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(pages)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult?.count || 0);

    let query = this.dbProvider.client
      .select()
      .from(pages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pages.publishedAt), desc(pages.createdAt))
      .$dynamic();

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      query = query.limit(filter.limit).offset(offset);
    }

    const items = await query;
    return { items, total };
  }

  async update(id: string, patch: Partial<NewPage>): Promise<Page> {
    const [row] = await this.dbProvider.client.update(pages).set(patch).where(eq(pages.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(pages).where(eq(pages.id, id));
  }
}
