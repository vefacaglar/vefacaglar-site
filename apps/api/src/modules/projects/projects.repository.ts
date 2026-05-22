import { projects, localizations } from "@vefacaglar/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IProjectsRepository } from "./projects.repository.interface";
import { mergeTranslations, LanguageProvider } from "../../shared/localization";

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

@injectable()
export class DrizzleProjectsRepository implements IProjectsRepository {
  constructor(
    private readonly dbProvider: DbProvider,
    private readonly langProvider: LanguageProvider
  ) {}

  async create(values: NewProject): Promise<Project> {
    const [row] = await this.dbProvider.client.insert(projects).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Project | null> {
    const [row] = await this.dbProvider.client.select().from(projects).where(eq(projects.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Project | null> {
    const lang = this.langProvider.getLanguage();
    const [row] = await this.dbProvider.client
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);

    if (!row || !lang || lang === 'en') return row ?? null;

    const translations = await this.dbProvider.client
      .select({ field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'project'),
        eq(localizations.entityId, row.id),
        eq(localizations.languageCode, lang)
      ));

    return mergeTranslations(row, translations);
  }

  async list(filter?: { status?: "draft" | "published" }): Promise<Project[]> {
    const lang = this.langProvider.getLanguage();
    const rows = await this.listRaw(filter);

    if (rows.length === 0 || !lang || lang === 'en') return rows;

    const ids = rows.map((r) => r.id);
    const allTranslations = await this.dbProvider.client
      .select({ entityId: localizations.entityId, field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'project'),
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
      const projectTranslations = translationsMap[row.id] || [];
      return mergeTranslations(row, projectTranslations);
    });
  }

  async listRaw(filter?: { status?: "draft" | "published" }): Promise<Project[]> {
    const conditions = filter?.status ? [eq(projects.status, filter.status)] : [];

    return await this.dbProvider.client
      .select()
      .from(projects)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(projects.featured), asc(projects.sortOrder), desc(projects.createdAt));
  }

  async update(id: string, patch: Partial<NewProject>): Promise<Project> {
    const [row] = await this.dbProvider.client.update(projects).set(patch).where(eq(projects.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(projects).where(eq(projects.id, id));
  }
}
