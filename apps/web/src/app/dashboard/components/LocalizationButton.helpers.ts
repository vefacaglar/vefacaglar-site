export type LocalizationEntityType = "page" | "post" | "project";

export type LocalizationField =
  | "title"
  | "excerpt"
  | "content"
  | "seoTitle"
  | "seoDescription"
  | "summary";

export interface LocalizationQueryInput {
  entityType: LocalizationEntityType;
  entityId: string;
  languageCode: "tr";
  field?: string;
}

export function buildLocalizationQueryPath(input: LocalizationQueryInput): string {
  const params = new URLSearchParams({
    entityType: input.entityType,
    entityId: input.entityId,
    languageCode: input.languageCode,
  });

  if (input.field) {
    params.set("field", input.field);
  }

  return `/api/localizations?${params.toString()}`;
}

export function resolveInitialModalState(
  fetched: { value?: string | null } | null | undefined,
  fallbackValue?: string | null
): { value: string; hasSavedTranslation: boolean } {
  const hasSavedTranslation = Boolean(fetched?.value);
  return {
    value: hasSavedTranslation ? (fetched?.value as string) : fallbackValue || "",
    hasSavedTranslation,
  };
}

export function formatEntityRemoveFeedback(
  deletedCount: number | undefined,
  messages: { removedAll: string; nothingToRemove: string }
): string {
  return deletedCount && deletedCount > 0 ? messages.removedAll : messages.nothingToRemove;
}
