import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { genres } from "@vefacaglar/db";

export type Genre = InferSelectModel<typeof genres>;
export type NewGenre = InferInsertModel<typeof genres>;

export interface IGenresRepository {
  create(values: NewGenre): Promise<Genre>;
  findById(id: string): Promise<Genre | null>;
  findBySlug(slug: string): Promise<Genre | null>;
  list(filter?: { page?: number; limit?: number }): Promise<{ items: Genre[]; total: number }>;
  update(id: string, patch: Partial<NewGenre>): Promise<Genre>;
  delete(id: string): Promise<void>;
}
