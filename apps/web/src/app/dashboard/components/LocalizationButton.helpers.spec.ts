import { describe, expect, it } from "vitest";
import {
  buildLocalizationQueryPath,
  formatEntityRemoveFeedback,
  resolveInitialModalState,
} from "./LocalizationButton.helpers";

describe("buildLocalizationQueryPath", () => {
  it("includes field when provided for single-field lookup or deletion", () => {
    expect(
      buildLocalizationQueryPath({
        entityType: "post",
        entityId: "550e8400-e29b-41d4-a716-446655440000",
        languageCode: "tr",
        field: "title",
      })
    ).toBe(
      "/api/localizations?entityType=post&entityId=550e8400-e29b-41d4-a716-446655440000&languageCode=tr&field=title"
    );
  });

  it("omits field when deleting all Turkish translations for an entity", () => {
    expect(
      buildLocalizationQueryPath({
        entityType: "page",
        entityId: "550e8400-e29b-41d4-a716-446655440000",
        languageCode: "tr",
      })
    ).toBe(
      "/api/localizations?entityType=page&entityId=550e8400-e29b-41d4-a716-446655440000&languageCode=tr"
    );
  });
});

describe("resolveInitialModalState", () => {
  it("marks hasSavedTranslation true and uses saved value when present", () => {
    expect(resolveInitialModalState({ value: "Hakkında" }, "About")).toEqual({
      value: "Hakkında",
      hasSavedTranslation: true,
    });
  });

  it("marks hasSavedTranslation false and falls back to initialValue when not saved", () => {
    expect(resolveInitialModalState(null, "About")).toEqual({
      value: "About",
      hasSavedTranslation: false,
    });
    expect(resolveInitialModalState({ value: "" }, null)).toEqual({
      value: "",
      hasSavedTranslation: false,
    });
  });
});

describe("formatEntityRemoveFeedback", () => {
  const messages = {
    removedAll: "Turkish translation removed.",
    nothingToRemove: "No Turkish translation was saved.",
  };

  it("returns removedAll when one or more rows were deleted", () => {
    expect(formatEntityRemoveFeedback(2, messages)).toBe("Turkish translation removed.");
  });

  it("returns nothingToRemove when zero rows were deleted", () => {
    expect(formatEntityRemoveFeedback(0, messages)).toBe("No Turkish translation was saved.");
    expect(formatEntityRemoveFeedback(undefined, messages)).toBe(
      "No Turkish translation was saved."
    );
  });
});
