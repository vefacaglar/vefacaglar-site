import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { publishers } from "@vefacaglar/db";

export type Publisher = InferSelectModel<typeof publishers>;
export type NewPublisher = InferInsertModel<typeof publishers>;

export interface IPublishersRepository {
  create(values: NewPublisher): Promise<Publisher>;
  findById(id: string): Promise<Publisher | null>;
  findBySlug(slug: string): Promise<Publisher | null>;
  list(filter?: { page?: number; limit?: number }): Promise<{ items: Publisher[]; total: number }>;
  update(id: string, patch: Partial<NewPublisher>): Promise<Publisher>;
  delete(id: string): Promise<void>;
}
