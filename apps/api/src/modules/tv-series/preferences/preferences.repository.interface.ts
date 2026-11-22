import type { TvPreferences } from "./preferences.schema";
export const TV_PREFERENCES_REPOSITORY = Symbol("TvPreferencesRepository");
export type TvPreferenceWriteResult =
  | { kind: "saved"; preferences: TvPreferences }
  | { kind: "missing" }
  | { kind: "conflict" };
export interface ITvPreferencesRepository {
  find(userId: string, seriesId: number): Promise<TvPreferences | null>;
  setRating(userId: string, seriesId: number, rating: number | null, expectedVersion: number): Promise<TvPreferenceWriteResult>;
  setNote(userId: string, seriesId: number, note: string | null, expectedVersion: number): Promise<TvPreferenceWriteResult>;
}
