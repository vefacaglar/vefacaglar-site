export type GameCompletionTimes = {
  creditsSeconds: number | null;
  extrasSeconds: number | null;
  completionistSeconds: number | null;
  sampleCount: number;
  source: "IGDB";
  updatedAt: string | null;
};

export function formatCompletionDuration(seconds: number): string {
  if (seconds < 60) return "<1 min";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.round(seconds / 360) / 10;
  return `${hours} h`;
}

export function compactCompletionTime(times: GameCompletionTimes | null | undefined): string | null {
  if (!times) return null;
  if (times.creditsSeconds !== null) return `${formatCompletionDuration(times.creditsSeconds)} to credits · IGDB`;
  if (times.extrasSeconds !== null) return `${formatCompletionDuration(times.extrasSeconds)} with extras · IGDB`;
  if (times.completionistSeconds !== null) return `${formatCompletionDuration(times.completionistSeconds)} to 100% · IGDB`;
  return null;
}
