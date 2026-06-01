import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { themes } from "@vefacaglar/db";

export type Theme = InferSelectModel<typeof themes>;
export type NewTheme = InferInsertModel<typeof themes>;

export interface IThemesRepository {
  create(values: NewTheme): Promise<Theme>;
  findById(id: string): Promise<Theme | null>;
  findBySlug(slug: string): Promise<Theme | null>;
  list(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Theme[]; total: number }>;
  update(id: string, patch: Partial<NewTheme>): Promise<Theme>;
  delete(id: string): Promise<void>;
}
