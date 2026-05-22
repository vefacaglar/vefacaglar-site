import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { platforms } from "@vefacaglar/db";

export type Platform = InferSelectModel<typeof platforms>;
export type NewPlatform = InferInsertModel<typeof platforms>;

export interface IPlatformsRepository {
  create(values: NewPlatform): Promise<Platform>;
  findById(id: string): Promise<Platform | null>;
  findBySlug(slug: string): Promise<Platform | null>;
  list(filter?: { page?: number; limit?: number }): Promise<{ items: Platform[]; total: number }>;
  update(id: string, patch: Partial<NewPlatform>): Promise<Platform>;
  delete(id: string): Promise<void>;
}
