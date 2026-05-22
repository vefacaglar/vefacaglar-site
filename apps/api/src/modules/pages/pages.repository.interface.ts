import type { Page, NewPage } from "./pages.repository";

export interface IPagesRepository {
  create(values: NewPage): Promise<Page>;
  findById(id: string): Promise<Page | null>;
  findBySlug(slug: string): Promise<Page | null>;
  list(filter?: { status?: "draft" | "published" }): Promise<Page[]>;
  listRaw(filter?: { status?: "draft" | "published" }): Promise<Page[]>;
  update(id: string, patch: Partial<NewPage>): Promise<Page>;
  delete(id: string): Promise<void>;
}
