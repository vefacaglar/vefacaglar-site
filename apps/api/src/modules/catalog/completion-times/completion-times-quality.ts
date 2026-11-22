import type { GameCompletionTimesRow } from "./completion-times.types";

// Site display policy, applied consistently to each reported category. IGDB
// contains extreme playtime submissions that are unsuitable as completion times.
export const MAX_COMPLETION_SECONDS = 1000 * 60 * 60;

export type CompletionTimesSource = Pick<GameCompletionTimesRow,
  "hastilySeconds" | "normallySeconds" | "completelySeconds" | "sampleCount" | "sourceUpdatedAt">;

export function usableCompletionTimes(row: CompletionTimesSource | null | undefined) {
  if (!row || !Number.isSafeInteger(row.sampleCount) || row.sampleCount < 1) return null;
  const seconds = [row.hastilySeconds, row.normallySeconds, row.completelySeconds].map((value) =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_COMPLETION_SECONDS ? value : null);
  const invalid = new Set<number>();
  // A contradictory pair gives no evidence about which submission is correct.
  // Suppress that pair while retaining independently usable categories.
  for (let earlier = 0; earlier < seconds.length; earlier++) {
    for (let later = earlier + 1; later < seconds.length; later++) {
      if (seconds[earlier] !== null && seconds[later] !== null && seconds[earlier]! > seconds[later]!) {
        invalid.add(earlier);
        invalid.add(later);
      }
    }
  }
  const [creditsSeconds, extrasSeconds, completionistSeconds] = seconds.map((value, index) => invalid.has(index) ? null : value);
  if (creditsSeconds === null && extrasSeconds === null && completionistSeconds === null) return null;
  return { creditsSeconds, extrasSeconds, completionistSeconds, sampleCount: row.sampleCount,
    source: "IGDB" as const, updatedAt: row.sourceUpdatedAt?.toISOString() ?? null };
}
