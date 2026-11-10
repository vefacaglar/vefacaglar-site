import type { Localization, NewLocalization } from "@vefacaglar/db";

export type UpsertLocalizationValues = Pick<
  NewLocalization,
  "entityType" | "entityId" | "languageCode" | "field" | "value"
>;

export type FindLocalizationValues = Omit<UpsertLocalizationValues, "value">;

export interface ILocalizationsRepository {
  findOne(values: FindLocalizationValues): Promise<Localization | null>;
  upsert(values: UpsertLocalizationValues): Promise<Localization>;
  deleteOne(values: FindLocalizationValues): Promise<number>;
  deleteByEntity(
    entityType: string,
    entityId: string,
    languageCode: string
  ): Promise<number>;
  findByEntity(
    entityType: string,
    entityId: string,
    languageCode: string
  ): Promise<{ field: string; value: string }[]>;
  findByEntities(
    entityType: string,
    entityIds: string[],
    languageCode: string
  ): Promise<Record<string, { field: string; value: string }[]>>;
}
