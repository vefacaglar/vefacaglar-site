import { packageGroups, packages, docCategories, docs } from "@vefacaglar/db";
import { and, desc, asc, eq, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type {
  IPackagesRepository,
  DocCategory,
  NewDocCategory,
  Doc,
  NewDoc,
  PackageItem,
  NewPackageItem,
  PackageListItem,
} from "./packages.repository.interface";

export type Package = InferSelectModel<typeof packageGroups>;
export type NewPackage = InferInsertModel<typeof packageGroups>;
export type { PackageListItem };

@injectable()
export class DrizzlePackagesRepository implements IPackagesRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewPackage): Promise<Package> {
    const [row] = await this.dbProvider.client.insert(packageGroups).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Package | null> {
    const [row] = await this.dbProvider.client.select().from(packageGroups).where(eq(packageGroups.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Package | null> {
    const [row] = await this.dbProvider.client.select().from(packageGroups).where(eq(packageGroups.slug, slug)).limit(1);
    return row ?? null;
  }

  async list(filter?: { page?: number; limit?: number; q?: string; isActive?: boolean }): Promise<{ items: PackageListItem[]; total: number }> {
    const conditions = [];
    if (filter?.q) {
      conditions.push(sql`(${packageGroups.name} ILIKE ${'%' + filter.q + '%'} OR ${packageGroups.slug} ILIKE ${'%' + filter.q + '%'})`);
    }
    if (filter?.isActive !== undefined) {
      conditions.push(eq(packageGroups.isActive, filter.isActive));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = this.dbProvider.client
      .select({
        id: packageGroups.id,
        slug: packageGroups.slug,
        name: packageGroups.name,
        description: packageGroups.description,
        githubUrl: packageGroups.githubUrl,
        docs: packageGroups.docs,
        latestVersion: packageGroups.latestVersion,
        isActive: packageGroups.isActive,
        createdAt: packageGroups.createdAt,
        updatedAt: packageGroups.updatedAt,
        packageCount: sql<number>`count(${packages.id})`,
      })
      .from(packageGroups)
      .leftJoin(packages, eq(packages.groupId, packageGroups.id))
      .where(whereClause)
      .groupBy(
        packageGroups.id,
        packageGroups.slug,
        packageGroups.name,
        packageGroups.description,
        packageGroups.githubUrl,
        packageGroups.docs,
        packageGroups.latestVersion,
        packageGroups.isActive,
        packageGroups.createdAt,
        packageGroups.updatedAt,
      )
      .orderBy(desc(packageGroups.createdAt))
      .$dynamic();

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      dataQuery = dataQuery.limit(filter.limit).offset(offset);
    }

    const countQuery = this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(packageGroups)
      .where(whereClause);

    const [countResult, items] = await Promise.all([countQuery, dataQuery]);
    const total = Number(countResult[0]?.count || 0);

    return {
      items: items.map((item) => ({
        ...item,
        packageCount: Number(item.packageCount),
      })),
      total,
    };
  }

  async update(id: string, patch: Partial<NewPackage>): Promise<Package> {
    const [row] = await this.dbProvider.client.update(packageGroups).set(patch).where(eq(packageGroups.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(packageGroups).where(eq(packageGroups.id, id));
  }

  // --- Package Item Operations ---

  async createPackageItem(values: NewPackageItem): Promise<PackageItem> {
    const [row] = await this.dbProvider.client.insert(packages).values(values).returning();
    return row;
  }

  async listPackageItems(groupId: string): Promise<PackageItem[]> {
    return this.dbProvider.client
      .select()
      .from(packages)
      .where(eq(packages.groupId, groupId))
      .orderBy(asc(packages.name), desc(packages.createdAt));
  }

  async updatePackageItem(id: string, patch: Partial<NewPackageItem>): Promise<PackageItem> {
    const [row] = await this.dbProvider.client.update(packages).set(patch).where(eq(packages.id, id)).returning();
    return row;
  }

  async deletePackageItem(id: string): Promise<void> {
    await this.dbProvider.client.delete(packages).where(eq(packages.id, id));
  }

  async findPackageItemById(id: string): Promise<PackageItem | null> {
    const [row] = await this.dbProvider.client.select().from(packages).where(eq(packages.id, id)).limit(1);
    return row ?? null;
  }

  async findPackageItemBySlug(slug: string): Promise<PackageItem | null> {
    const [row] = await this.dbProvider.client.select().from(packages).where(eq(packages.slug, slug)).limit(1);
    return row ?? null;
  }

  // --- DocCategory Operations ---

  async createCategory(values: NewDocCategory): Promise<DocCategory> {
    const [row] = await this.dbProvider.client.insert(docCategories).values(values).returning();
    return row;
  }

  async listCategories(groupId: string): Promise<DocCategory[]> {
    return this.dbProvider.client
      .select()
      .from(docCategories)
      .where(eq(docCategories.groupId, groupId))
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

  async findCategoryBySlug(groupId: string, slug: string): Promise<DocCategory | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(docCategories)
      .where(and(eq(docCategories.groupId, groupId), eq(docCategories.slug, slug)))
      .limit(1);
    return row ?? null;
  }

  // --- Doc Operations ---

  async createDoc(values: NewDoc): Promise<Doc> {
    const [row] = await this.dbProvider.client.insert(docs).values(values).returning();
    return row;
  }

  async listDocs(groupId: string): Promise<Doc[]> {
    return this.dbProvider.client
      .select()
      .from(docs)
      .where(eq(docs.groupId, groupId))
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

  async findDocBySlug(groupId: string, slug: string): Promise<Doc | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(docs)
      .where(and(eq(docs.groupId, groupId), eq(docs.slug, slug)))
      .limit(1);
    return row ?? null;
  }
}
