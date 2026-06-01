import { projects, localizations } from "@vefacaglar/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IProjectsRepository, ProjectListItem } from "./projects.repository.interface";
import { mergeTranslations, groupTranslationsByEntity, LanguageProvider } from "../../shared/localization";

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

  async list(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: ProjectListItem[]; total: number }> {
    const lang = this.langProvider.getLanguage();
    const { items: rows, total } = await this.listRaw(filter);

    if (rows.length === 0 || !lang || lang === 'en') return { items: rows, total };

    const ids = rows.map((r) => r.id);
    const allTranslations = await this.dbProvider.client
      .select({ entityId: localizations.entityId, field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, 'project'),
        inArray(localizations.entityId, ids),
        eq(localizations.languageCode, lang)
      ));

    const translationsMap = groupTranslationsByEntity(allTranslations);

    const translatedItems = rows.map((row) =>
      mergeTranslations(row, translationsMap[row.id] ?? [])
    );

    return { items: translatedItems, total };
  }

  async listRaw(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: ProjectListItem[]; total: number }> {
    const conditions = filter?.status ? [eq(projects.status, filter.status)] : [];
    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = this.dbProvider.client
      .select({
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        summary: projects.summary,
        status: projects.status,
        featured: projects.featured,
        sortOrder: projects.sortOrder,
        githubUrl: projects.githubUrl,
        liveUrl: projects.liveUrl,
        coverImageUrl: projects.coverImageUrl,
        seoTitle: projects.seoTitle,
        seoDescription: projects.seoDescription,
        startedAt: projects.startedAt,
        endedAt: projects.endedAt,
        publishedAt: projects.publishedAt,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(whereExpr)
      .orderBy(desc(projects.featured), asc(projects.sortOrder), desc(projects.createdAt))
      .$dynamic();

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      dataQuery = dataQuery.limit(filter.limit).offset(offset);
    }

    const countQuery = this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereExpr);

    const [countResult, items] = await Promise.all([countQuery, dataQuery]);
    const total = Number(countResult[0]?.count || 0);

    return { items, total };
  }

  async update(id: string, patch: Partial<NewProject>): Promise<Project> {
    const [row] = await this.dbProvider.client.update(projects).set(patch).where(eq(projects.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(projects).where(eq(projects.id, id));
  }
}
