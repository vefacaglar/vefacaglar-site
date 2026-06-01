import { packages, docCategories, docs } from "@vefacaglar/db";
import { and, desc, asc, eq, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IPackagesRepository, DocCategory, NewDocCategory, Doc, NewDoc, PackageListItem } from "./packages.repository.interface";

export type Package = InferSelectModel<typeof packages>;
export type NewPackage = InferInsertModel<typeof packages>;
export type { PackageListItem };

@injectable()
export class DrizzlePackagesRepository implements IPackagesRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewPackage): Promise<Package> {
    const [row] = await this.dbProvider.client.insert(packages).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Package | null> {
    const [row] = await this.dbProvider.client.select().from(packages).where(eq(packages.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Package | null> {
    const [row] = await this.dbProvider.client.select().from(packages).where(eq(packages.slug, slug)).limit(1);
    return row ?? null;
  }

  async list(filter?: { page?: number; limit?: number; q?: string; isActive?: boolean }): Promise<{ items: PackageListItem[]; total: number }> {
    const conditions = [];
    if (filter?.q) {
      conditions.push(sql`(${packages.name} ILIKE ${'%' + filter.q + '%'} OR ${packages.slug} ILIKE ${'%' + filter.q + '%'})`);
    }
    if (filter?.isActive !== undefined) {
      conditions.push(eq(packages.isActive, filter.isActive));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = this.dbProvider.client
      .select({
        id: packages.id,
        slug: packages.slug,
        name: packages.name,
        description: packages.description,
        nugetUrl: packages.nugetUrl,
        npmUrl: packages.npmUrl,
        githubUrl: packages.githubUrl,
        docs: packages.docs,
        latestVersion: packages.latestVersion,
        isActive: packages.isActive,
        createdAt: packages.createdAt,
        updatedAt: packages.updatedAt,
      })
      .from(packages)
      .where(whereClause)
      .orderBy(desc(packages.createdAt))
      .$dynamic();

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      dataQuery = dataQuery.limit(filter.limit).offset(offset);
    }

    const countQuery = this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(packages)
      .where(whereClause);

    const [countResult, items] = await Promise.all([countQuery, dataQuery]);
    const total = Number(countResult[0]?.count || 0);

    return { items, total };
  }

  async update(id: string, patch: Partial<NewPackage>): Promise<Package> {
    const [row] = await this.dbProvider.client.update(packages).set(patch).where(eq(packages.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(packages).where(eq(packages.id, id));
  }

  // --- DocCategory Operations ---

  async createCategory(values: NewDocCategory): Promise<DocCategory> {
    const [row] = await this.dbProvider.client.insert(docCategories).values(values).returning();
    return row;
  }

  async listCategories(packageId: string): Promise<DocCategory[]> {
    return this.dbProvider.client
      .select()
      .from(docCategories)
      .where(eq(docCategories.packageId, packageId))
      .orderBy(asc(docCategories.displayOrder));
  }

  async updateCategory(id: string, patch: Partial<NewDocCategory>): Promise<DocCategory> {
    const [row] = await this.dbProvider.client.update(docCategories).set(patch).where(eq(docCategories.id, id)).returning();
    return row;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.dbProvider.client.delete(docCategories).where(eq(docCategories.id, id));
  }

  async findCategoryById(id: string): Promise<DocCategory | null> {
    const [row] = await this.dbProvider.client.select().from(docCategories).where(eq(docCategories.id, id)).limit(1);
    return row ?? null;
  }

  async findCategoryBySlug(packageId: string, slug: string): Promise<DocCategory | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(docCategories)
      .where(and(eq(docCategories.packageId, packageId), eq(docCategories.slug, slug)))
      .limit(1);
    return row ?? null;
  }

  // --- Doc Operations ---

  async createDoc(values: NewDoc): Promise<Doc> {
    const [row] = await this.dbProvider.client.insert(docs).values(values).returning();
    return row;
  }

  async listDocs(packageId: string): Promise<Doc[]> {
    return this.dbProvider.client
      .select()
      .from(docs)
      .where(eq(docs.packageId, packageId))
      .orderBy(asc(docs.displayOrder), desc(docs.createdAt));
  }

  async updateDoc(id: string, patch: Partial<NewDoc>): Promise<Doc> {
    const [row] = await this.dbProvider.client.update(docs).set(patch).where(eq(docs.id, id)).returning();
    return row;
  }

  async deleteDoc(id: string): Promise<void> {
    await this.dbProvider.client.delete(docs).where(eq(docs.id, id));
  }

  async findDocById(id: string): Promise<Doc | null> {
    const [row] = await this.dbProvider.client.select().from(docs).where(eq(docs.id, id)).limit(1);
    return row ?? null;
  }

  async findDocBySlug(packageId: string, slug: string): Promise<Doc | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(docs)
      .where(and(eq(docs.packageId, packageId), eq(docs.slug, slug)))
      .limit(1);
    return row ?? null;
  }
}
