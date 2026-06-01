import { platforms } from "@vefacaglar/db";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IPlatformsRepository, Platform, NewPlatform } from "./platforms.repository.interface";

@injectable()
export class DrizzlePlatformsRepository implements IPlatformsRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewPlatform): Promise<Platform> {
    const [row] = await this.dbProvider.client.insert(platforms).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Platform | null> {
    const [row] = await this.dbProvider.client.select().from(platforms).where(eq(platforms.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Platform | null> {
    const [row] = await this.dbProvider.client.select().from(platforms).where(eq(platforms.slug, slug)).limit(1);
    return row ?? null;
  }

  async list(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Platform[]; total: number }> {
    const q = filter?.q?.trim();
    const whereExpr = q
      ? or(ilike(platforms.name, `%${q}%`), ilike(platforms.slug, `%${q}%`))
      : undefined;

    const countQuery = this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(platforms)
      .$dynamic();
    if (whereExpr) countQuery.where(whereExpr);

    let dataQuery = this.dbProvider.client
      .select()
      .from(platforms)
      .orderBy(asc(platforms.name))
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

  async update(id: string, patch: Partial<NewPlatform>): Promise<Platform> {
    const [row] = await this.dbProvider.client.update(platforms).set(patch).where(eq(platforms.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(platforms).where(eq(platforms.id, id));
  }
}
