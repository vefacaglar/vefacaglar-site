import type { Page, NewPage } from "./pages.repository";

export interface IPagesRepository {
  create(values: NewPage): Promise<Page>;
  findById(id: string, lang?: string): Promise<Page | null>;
  findBySlug(slug: string, lang?: string): Promise<Page | null>;
  list(filter?: { status?: "draft" | "published" }, lang?: string): Promise<Page[]>;
  update(id: string, patch: Partial<NewPage>): Promise<Page>;
  delete(id: string): Promise<void>;
}
