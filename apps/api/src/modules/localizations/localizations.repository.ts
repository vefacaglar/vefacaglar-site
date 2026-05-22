import { localizations } from "@vefacaglar/db";
import { and, eq } from "drizzle-orm";
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
}
