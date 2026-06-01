import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { packageGroups, packages, docCategories, docs } from "@vefacaglar/db";

export type PackageGroup = InferSelectModel<typeof packageGroups>;
export type NewPackageGroup = InferInsertModel<typeof packageGroups>;
export type Package = PackageGroup;
export type NewPackage = NewPackageGroup;

export type PackageItem = InferSelectModel<typeof packages>;
export type NewPackageItem = InferInsertModel<typeof packages>;

export type DocCategory = InferSelectModel<typeof docCategories>;
export type NewDocCategory = InferInsertModel<typeof docCategories>;

export type Doc = InferSelectModel<typeof docs>;
export type NewDoc = InferInsertModel<typeof docs>;

export type PackageListItem = Omit<Package, "content"> & { packageCount: number };

export interface IPackagesRepository {
  create(values: NewPackage): Promise<Package>;
  findById(id: string): Promise<Package | null>;
  findBySlug(slug: string): Promise<Package | null>;
  list(filter?: { page?: number; limit?: number; q?: string; isActive?: boolean }): Promise<{ items: PackageListItem[]; total: number }>;
  update(id: string, patch: Partial<NewPackage>): Promise<Package>;
  delete(id: string): Promise<void>;

  createPackageItem(values: NewPackageItem): Promise<PackageItem>;
  listPackageItems(groupId: string): Promise<PackageItem[]>;
  updatePackageItem(id: string, patch: Partial<NewPackageItem>): Promise<PackageItem>;
  deletePackageItem(id: string): Promise<void>;
  findPackageItemById(id: string): Promise<PackageItem | null>;
  findPackageItemBySlug(slug: string): Promise<PackageItem | null>;
  findPackageItemByGroupAndSlug(groupId: string, slug: string): Promise<PackageItem | null>;

  createCategory(values: NewDocCategory): Promise<DocCategory>;
  listCategories(groupId: string): Promise<DocCategory[]>;
  updateCategory(id: string, patch: Partial<NewDocCategory>): Promise<DocCategory>;
  deleteCategory(id: string): Promise<void>;
  findCategoryById(id: string): Promise<DocCategory | null>;
  findCategoryBySlug(groupId: string, slug: string): Promise<DocCategory | null>;

  createDoc(values: NewDoc): Promise<Doc>;
  listDocs(groupId: string): Promise<Doc[]>;
  updateDoc(id: string, patch: Partial<NewDoc>): Promise<Doc>;
  deleteDoc(id: string): Promise<void>;
  findDocById(id: string): Promise<Doc | null>;
  findDocBySlug(groupId: string, slug: string): Promise<Doc | null>;
}
