import type { Localization, NewLocalization } from "@vefacaglar/db";

export type UpsertLocalizationValues = Pick<
  NewLocalization,
  "entityType" | "entityId" | "languageCode" | "field" | "value"
>;

export type FindLocalizationValues = Omit<UpsertLocalizationValues, "value">;

export interface ILocalizationsRepository {
  findOne(values: FindLocalizationValues): Promise<Localization | null>;
  upsert(values: UpsertLocalizationValues): Promise<Localization>;
  findByEntity(
    entityType: string,
    entityId: string,
    languageCode: string
  ): Promise<{ field: string; value: string }[]>;
}
