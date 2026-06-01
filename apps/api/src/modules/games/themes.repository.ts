import { themes } from "@vefacaglar/db";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IThemesRepository, Theme, NewTheme } from "./themes.repository.interface";

@injectable()
export class DrizzleThemesRepository implements IThemesRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewTheme): Promise<Theme> {
    const [row] = await this.dbProvider.client.insert(themes).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Theme | null> {
    const [row] = await this.dbProvider.client.select().from(themes).where(eq(themes.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Theme | null> {
    const [row] = await this.dbProvider.client.select().from(themes).where(eq(themes.slug, slug)).limit(1);
    return row ?? null;
  }

  async list(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Theme[]; total: number }> {
    const q = filter?.q?.trim();
    const whereExpr = q
      ? or(ilike(themes.name, `%${q}%`), ilike(themes.slug, `%${q}%`))
      : undefined;

    const countQuery = this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(themes)
      .$dynamic();
    if (whereExpr) countQuery.where(whereExpr);

    let dataQuery = this.dbProvider.client
      .select()
      .from(themes)
      .orderBy(asc(themes.name))
      .$dynamic();

    if (whereExpr) dataQuery = dataQuery.where(whereExpr);

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      dataQuery = dataQuery.limit(filter.limit).offset(offset);
    }

    const [countResult, items] = await Promise.all([countQuery, dataQuery]);
    const total = Number(countResult[0]?.count || 0);

    return { items, total };
  }

  async update(id: string, patch: Partial<NewTheme>): Promise<Theme> {
    const [row] = await this.dbProvider.client.update(themes).set(patch).where(eq(themes.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(themes).where(eq(themes.id, id));
  }
}
