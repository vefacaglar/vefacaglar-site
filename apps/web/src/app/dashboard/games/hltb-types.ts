export type HltbTimes = { mainHours: number | null; mainExtraHours: number | null; completionistHours: number | null };
export type HltbCandidate = { hltbId: number; title: string; releaseYear: number | null; times: HltbTimes; sourceUrl: string; warnings: string[] };
export type HltbSavedGame = { id: string; title: string; releaseYear: number | null; hltbId: number | null; mappingSource: string | null; times: HltbTimes };
export type HltbLookup = { game: HltbSavedGame; expectedVersion: string; receiptId: string; query: string; outcome: "matches" | "no_match" | "provider_unavailable"; candidates: HltbCandidate[]; expiresAt: string; retryAfter: string | null; cached: boolean; pendingSearchSync: boolean };
export type HltbApplyInput = { receiptId: string; hltbId: number; expectedVersion: string; overwriteFields: (keyof HltbTimes)[]; replaceMapping: boolean; acknowledgeMismatch: boolean };
export type HltbApplied = { game: HltbSavedGame; searchSync: "synced" | "pending" };
export function sameHours(a: HltbTimes, b: HltbTimes): boolean {
  return a.mainHours === b.mainHours && a.mainExtraHours === b.mainExtraHours && a.completionistHours === b.completionistHours;
}
export function toHours(value: string | number | null): number | null {
  return value === "" || value === null ? null : Number(value);
}
