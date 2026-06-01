import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { projects } from "@vefacaglar/db";

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;
export type ProjectListItem = Omit<Project, "content">;

export interface IProjectsRepository {
  create(values: NewProject): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findBySlug(slug: string): Promise<Project | null>;
  list(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: ProjectListItem[]; total: number }>;
  listRaw(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: ProjectListItem[]; total: number }>;
  update(id: string, patch: Partial<NewProject>): Promise<Project>;
  delete(id: string): Promise<void>;
}
