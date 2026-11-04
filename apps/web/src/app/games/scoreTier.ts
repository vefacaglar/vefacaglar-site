export type ScoreTier = "high" | "mid" | "low";

/** Critic score bands, matching the dashboard: 90+ is high, 75+ is mid. */
export function scoreTier(score: number): ScoreTier {
  if (score >= 90) return "high";
  if (score >= 75) return "mid";
  return "low";
}
