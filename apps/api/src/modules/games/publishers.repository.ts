import { publishers } from "@vefacaglar/db";
import { asc, eq, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IPublishersRepository, Publisher, NewPublisher } from "./publishers.repository.interface";

@injectable()
export class DrizzlePublishersRepository implements IPublishersRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewPublisher): Promise<Publisher> {
    const [row] = await this.dbProvider.client.insert(publishers).values(values).returning();
    return row;
  }

  async findById(id: string): Promise<Publisher | null> {
    const [row] = await this.dbProvider.client.select().from(publishers).where(eq(publishers.id, id)).limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Publisher | null> {
    const [row] = await this.dbProvider.client.select().from(publishers).where(eq(publishers.slug, slug)).limit(1);
    return row ?? null;
  }

  async list(filter?: { page?: number; limit?: number }): Promise<{ items: Publisher[]; total: number }> {
    const [countResult] = await this.dbProvider.client
      .select({ count: sql<number>`count(*)` })
      .from(publishers);

    const total = Number(countResult?.count || 0);

    let query = this.dbProvider.client
      .select()
      .from(publishers)
      .orderBy(asc(publishers.name))
      .$dynamic();

    if (filter?.page !== undefined && filter?.limit !== undefined) {
      const offset = (filter.page - 1) * filter.limit;
      query = query.limit(filter.limit).offset(offset);
    }

    const items = await query;
    return { items, total };
  }

  async update(id: string, patch: Partial<NewPublisher>): Promise<Publisher> {
    const [row] = await this.dbProvider.client.update(publishers).set(patch).where(eq(publishers.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(publishers).where(eq(publishers.id, id));
  }
}
