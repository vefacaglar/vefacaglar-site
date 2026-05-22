import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { projects } from "@vefacaglar/db";

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export interface IProjectsRepository {
  create(values: NewProject): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findBySlug(slug: string): Promise<Project | null>;
  list(filter?: { status?: "draft" | "published" }): Promise<Project[]>;
  update(id: string, patch: Partial<NewProject>): Promise<Project>;
  delete(id: string): Promise<void>;
}
