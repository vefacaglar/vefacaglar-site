import { injectable } from "tsyringe";
import { requestStorage } from "./localization.plugin";
import enDict from "./locales/en.json";
import trDict from "./locales/tr.json";

const locales: Record<string, Record<string, string>> = {
  en: enDict,
  tr: trDict,
};

@injectable()
export class LanguageProvider {
  getLanguage(): string {
    return requestStorage.getStore()?.lang ?? "en";
  }
}

export function translateError(key: string, lang = "en"): string {
  const dict = locales[lang] || locales.en;
  return dict[key] || locales.en[key] || key;
}

export function mergeTranslations<T extends Record<string, any>>(
  entity: T,
  translations: { field: string; value: string }[]
): T {
  const localized = { ...entity };
  for (const item of translations) {
    let targetField: string = item.field;
    if (!(targetField in localized)) {
      const camelCaseField = targetField.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (camelCaseField in localized) {
        targetField = camelCaseField;
      }
    }

    if (targetField in localized) {
      localized[targetField as keyof T] = item.value as any;
    }
  }
  return localized;
}

/**
 * Groups a flat list of localization rows by entity id, so each entity's
 * translations can be looked up in O(1) when merging.
 */
export function groupTranslationsByEntity(
  rows: { entityId: string; field: string; value: string }[]
): Record<string, { field: string; value: string }[]> {
  const map: Record<string, { field: string; value: string }[]> = {};
  for (const row of rows) {
    (map[row.entityId] ??= []).push(row);
  }
  return map;
}
