import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { packages, docCategories, docs } from "@vefacaglar/db";

export type Package = InferSelectModel<typeof packages>;
export type NewPackage = InferInsertModel<typeof packages>;

export type DocCategory = InferSelectModel<typeof docCategories>;
export type NewDocCategory = InferInsertModel<typeof docCategories>;

export type Doc = InferSelectModel<typeof docs>;
export type NewDoc = InferInsertModel<typeof docs>;

export interface IPackagesRepository {
  create(values: NewPackage): Promise<Package>;
  findById(id: string): Promise<Package | null>;
  findBySlug(slug: string): Promise<Package | null>;
  list(filter?: { page?: number; limit?: number; q?: string; isActive?: boolean }): Promise<{ items: Package[]; total: number }>;
  update(id: string, patch: Partial<NewPackage>): Promise<Package>;
  delete(id: string): Promise<void>;

  createCategory(values: NewDocCategory): Promise<DocCategory>;
  listCategories(packageId: string): Promise<DocCategory[]>;
  updateCategory(id: string, patch: Partial<NewDocCategory>): Promise<DocCategory>;
  deleteCategory(id: string): Promise<void>;
  findCategoryById(id: string): Promise<DocCategory | null>;
  findCategoryBySlug(packageId: string, slug: string): Promise<DocCategory | null>;

  createDoc(values: NewDoc): Promise<Doc>;
  listDocs(packageId: string): Promise<Doc[]>;
  updateDoc(id: string, patch: Partial<NewDoc>): Promise<Doc>;
  deleteDoc(id: string): Promise<void>;
  findDocById(id: string): Promise<Doc | null>;
  findDocBySlug(packageId: string, slug: string): Promise<Doc | null>;
}
