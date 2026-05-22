import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { developers } from "@vefacaglar/db";

export type Developer = InferSelectModel<typeof developers>;
export type NewDeveloper = InferInsertModel<typeof developers>;

export interface IDevelopersRepository {
  create(values: NewDeveloper): Promise<Developer>;
  findById(id: string): Promise<Developer | null>;
  findBySlug(slug: string): Promise<Developer | null>;
  list(filter?: { page?: number; limit?: number }): Promise<{ items: Developer[]; total: number }>;
  update(id: string, patch: Partial<NewDeveloper>): Promise<Developer>;
  delete(id: string): Promise<void>;
}
