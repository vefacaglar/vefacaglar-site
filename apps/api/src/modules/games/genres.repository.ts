import { genres } from "@vefacaglar/db";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IGenresRepository, Genre, NewGenre } from "./genres.repository.interface";

@injectable()
export class DrizzleGenresRepository implements IGenresRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewGenre): Promise<Genre> {
    const [row] = await this.dbProvider.client.insert(genres).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Genre | null> {
    const [row] = await this.dbProvider.client.select().from(genres).where(eq(genres.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Genre | null> {
    const [row] = await this.dbProvider.client.select().from(genres).where(eq(genres.slug, slug)).limit(1);
    return row ?? null;
  }

  async list(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Genre[]; total: number }> {
    const q = filter?.q?.trim();
    const whereExpr = q
      ? or(ilike(genres.name, `%${q}%`), ilike(genres.slug, `%${q}%`))
      : undefined;

    const countQuery = this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(genres)
      .$dynamic();
    if (whereExpr) countQuery.where(whereExpr);
    const [countResult] = await countQuery;

    const total = Number(countResult?.count || 0);

    let query = this.dbProvider.client
      .select()
      .from(genres)
      .orderBy(asc(genres.name))
      .$dynamic();

    if (whereExpr) query = query.where(whereExpr);

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      query = query.limit(filter.limit).offset(offset);
    }

    const items = await query;
    return { items, total };
  }

  async update(id: string, patch: Partial<NewGenre>): Promise<Genre> {
    const [row] = await this.dbProvider.client.update(genres).set(patch).where(eq(genres.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(genres).where(eq(genres.id, id));
  }
}
