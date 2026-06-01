import { localizations } from "@vefacaglar/db";
import { and, eq, inArray } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type {
  FindLocalizationValues,
  ILocalizationsRepository,
  UpsertLocalizationValues,
} from "./localizations.repository.interface";

@injectable()
export class DrizzleLocalizationsRepository implements ILocalizationsRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findOne(values: FindLocalizationValues) {
    const [row] = await this.dbProvider.client
      .select()
      .from(localizations)
      .where(and(
        eq(localizations.entityType, values.entityType),
        eq(localizations.entityId, values.entityId),
        eq(localizations.languageCode, values.languageCode),
        eq(localizations.field, values.field)
      ))
      .limit(1);

    return row ?? null;
  }

  async upsert(values: UpsertLocalizationValues) {
    const now = new Date();
    const [row] = await this.dbProvider.client
      .insert(localizations)
      .values({
        ...values,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          localizations.entityType,
          localizations.entityId,
          localizations.languageCode,
          localizations.field,
        ],
        set: {
          value: values.value,
          updatedAt: now,
        },
      })
      .returning();

    return row;
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    languageCode: string
  ): Promise<{ field: string; value: string }[]> {
    const rows = await this.dbProvider.client
      .select({ field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, entityType),
        eq(localizations.entityId, entityId),
        eq(localizations.languageCode, languageCode)
      ));

    return rows;
  }

  async findByEntities(
    entityType: string,
    entityIds: string[],
    languageCode: string
  ): Promise<Record<string, { field: string; value: string }[]>> {
    if (entityIds.length === 0) return {};
    const rows = await this.dbProvider.client
      .select({ entityId: localizations.entityId, field: localizations.field, value: localizations.value })
      .from(localizations)
      .where(and(
        eq(localizations.entityType, entityType),
        inArray(localizations.entityId, entityIds),
        eq(localizations.languageCode, languageCode)
      ));

    const map: Record<string, { field: string; value: string }[]> = {};
    for (const id of entityIds) map[id] = [];
    for (const row of rows) {
      (map[row.entityId] ??= []).push({ field: row.field, value: row.value });
    }
    return map;
  }
}
