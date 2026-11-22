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
  if (times.creditsSeconds !== null) return `${formatCompletionDuration(times.creditsSeconds)} reported to credits`;
  if (times.extrasSeconds !== null) return `${formatCompletionDuration(times.extrasSeconds)} reported with extras`;
  if (times.completionistSeconds !== null) return `${formatCompletionDuration(times.completionistSeconds)} reported to 100%`;
  return null;
}

export type CompletionReport = {
  provider: "backloggd" | "ifdb" | "vndb";
  sourceUrl: string;
  scope: string;
  statistic: "reported" | "median_finish" | "average_playtime";
  finishSeconds: number | null;
  masterSeconds: number | null;
  playtimeSeconds: number | null;
  sampleCount: number | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
};
export type CompletionSummary = {
  kind: "single" | "agreement" | "range";
  estimateSeconds: number | null;
  lowerSeconds: number;
  upperSeconds: number;
  providers: string[];
  excludedProviders: string[];
};

export const completionProviderName = (provider: string) => ({ igdb: "IGDB", backloggd: "Backloggd", ifdb: "IFDB", vndb: "VNDB" })[provider] ?? provider;

export function formatCompletionSummary(summary: CompletionSummary): string {
  if (summary.kind === "range") {
    return `${formatCompletionDuration(summary.lowerSeconds)}–${formatCompletionDuration(summary.upperSeconds)}`;
  }
  return formatCompletionDuration(summary.estimateSeconds!);
}

export function compactCompletionEstimate(summary: CompletionSummary | null | undefined): string | null {
  if (!summary) return null;
  const label = summary.kind === "range" ? "reported range" : "reported finish";
  return `${formatCompletionSummary(summary)} ${label}`;
}

export function compactIndependentCompletion(reports: CompletionReport[] | null | undefined): string | null {
  for (const report of reports ?? []) {
    if (report.playtimeSeconds !== null) return `${formatCompletionDuration(report.playtimeSeconds)} average play time`;
    if (report.masterSeconds !== null) return `${formatCompletionDuration(report.masterSeconds)} to master`;
  }
  return null;
}
