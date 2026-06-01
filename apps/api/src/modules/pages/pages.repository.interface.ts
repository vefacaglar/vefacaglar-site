import type { Page, NewPage, PageListItem } from "./pages.repository";

export interface IPagesRepository {
  create(values: NewPage): Promise<Page>;
  findById(id: string): Promise<Page | null>;
  findBySlug(slug: string): Promise<Page | null>;
  list(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: PageListItem[]; total: number }>;
  listRaw(filter?: { status?: "draft" | "published"; page?: number; limit?: number }): Promise<{ items: PageListItem[]; total: number }>;
  update(id: string, patch: Partial<NewPage>): Promise<Page>;
  delete(id: string): Promise<void>;
}
