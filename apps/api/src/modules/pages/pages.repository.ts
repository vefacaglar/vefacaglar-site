import { pages, localizations } from "@vefacaglar/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IPagesRepository } from "./pages.repository.interface";
import { mergeTranslations, LanguageProvider } from "../../shared/localization";

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
    const lang = this.langProvider.getLanguage();
    const [row] = await this.dbProvider.client.select().from(pages).where(eq(pages.id, id)).limit(1);
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

  async list(filter?: { status?: "draft" | "published" }): Promise<Page[]> {
    const lang = this.langProvider.getLanguage();
    const conditions = filter?.status ? [eq(pages.status, filter.status)] : [];

    const rows = await this.dbProvider.client
      .select()
      .from(pages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pages.publishedAt), desc(pages.createdAt));

    if (rows.length === 0 || !lang || lang === 'en') return rows;

    const ids = rows.map((r) => r.id);
    const allTranslations = await this.dbProvider.client
      .select({ entityId: localizations.entityId, field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'page'),
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
      const pageTranslations = translationsMap[row.id] || [];
      return mergeTranslations(row, pageTranslations);
    });
  }

  async update(id: string, patch: Partial<NewPage>): Promise<Page> {
    const [row] = await this.dbProvider.client.update(pages).set(patch).where(eq(pages.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(pages).where(eq(pages.id, id));
  }
}
