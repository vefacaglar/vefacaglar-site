import { developers } from "@vefacaglar/db";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IDevelopersRepository, Developer, NewDeveloper } from "./developers.repository.interface";

@injectable()
export class DrizzleDevelopersRepository implements IDevelopersRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewDeveloper): Promise<Developer> {
    const [row] = await this.dbProvider.client.insert(developers).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Developer | null> {
    const [row] = await this.dbProvider.client.select().from(developers).where(eq(developers.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Developer | null> {
    const [row] = await this.dbProvider.client.select().from(developers).where(eq(developers.slug, slug)).limit(1);
    return row ?? null;
  }

  async list(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Developer[]; total: number }> {
    const q = filter?.q?.trim();
    const whereExpr = q
      ? or(ilike(developers.name, `%${q}%`), ilike(developers.slug, `%${q}%`))
      : undefined;

    const countQuery = this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(developers)
      .$dynamic();
    if (whereExpr) countQuery.where(whereExpr);
    const [countResult] = await countQuery;

    const total = Number(countResult?.count || 0);

    let query = this.dbProvider.client
      .select()
      .from(developers)
      .orderBy(asc(developers.name))
      .$dynamic();

    if (whereExpr) query = query.where(whereExpr);

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      query = query.limit(filter.limit).offset(offset);
    }

    const items = await query;
    return { items, total };
  }

  async update(id: string, patch: Partial<NewDeveloper>): Promise<Developer> {
    const [row] = await this.dbProvider.client.update(developers).set(patch).where(eq(developers.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(developers).where(eq(developers.id, id));
  }
}
