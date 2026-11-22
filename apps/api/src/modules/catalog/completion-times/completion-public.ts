import type { CompletionTimesSource } from "./completion-times-quality";
import { usableCompletionTimes } from "./completion-times-quality";
import { completionConsensus } from "./completion-consensus";
import { completionSeconds } from "./completion-sources.parsers";
import type { CompletionProvider, CompletionReport } from "./completion-sources.types";

const iso = (value: unknown) => {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export function publicCompletionReports(raw: unknown): CompletionReport[] {
  if (!Array.isArray(raw)) return [];
  const reports: CompletionReport[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || !["backloggd", "ifdb", "vndb"].includes(row.provider) || seen.has(row.provider)) continue;
    const expectedOrigin = { backloggd: "https://backloggd.com/", ifdb: "https://ifdb.org/", vndb: "https://vndb.org/" }[row.provider as CompletionProvider];
    if (typeof row.sourceUrl !== "string" || !row.sourceUrl.startsWith(expectedOrigin) || !iso(row.fetchedAt)) continue;
    const finishSeconds = row.provider === "vndb" ? null : completionSeconds(row.finishSeconds);
    const masterSeconds = row.provider === "backloggd" ? completionSeconds(row.masterSeconds) : null;
    const playtimeSeconds = row.provider === "vndb" ? completionSeconds(row.playtimeSeconds) : null;
    if (finishSeconds === null && masterSeconds === null && playtimeSeconds === null) continue;
    seen.add(row.provider);
    reports.push({ provider: row.provider, sourceUrl: row.sourceUrl,
      scope: typeof row.scope === "string" ? row.scope : "Source game entry",
      statistic: row.provider === "ifdb" ? "median_finish" : row.provider === "vndb" ? "average_playtime" : "reported",
      finishSeconds, masterSeconds, playtimeSeconds, sampleCount: Number.isSafeInteger(row.sampleCount) && row.sampleCount > 0 ? row.sampleCount : null,
      sourceUpdatedAt: iso(row.sourceUpdatedAt), fetchedAt: iso(row.fetchedAt)! });
  }
  return reports.sort((a, b) => a.provider.localeCompare(b.provider));
}

/** Only reports about reaching a finish enter this family. Mastery, total play
 * time and VNDB average play-time votes remain separate source measurements. */
export function publicCompletionSummary(igdb: CompletionTimesSource | null | undefined, reports: CompletionReport[]) {
  const credits = usableCompletionTimes(igdb)?.creditsSeconds;
  const votes: { provider: string; seconds: number }[] = reports.flatMap((report) => report.finishSeconds !== null && ["backloggd", "ifdb"].includes(report.provider)
    ? [{ provider: report.provider, seconds: report.finishSeconds }] : []);
  if (credits) votes.push({ provider: "igdb", seconds: credits });
  return completionConsensus(votes);
}

/** Mastery/100% reports form their own family, never a vote for reaching credits. */
export function publicCompletionMasterSummary(igdb: CompletionTimesSource | null | undefined, reports: CompletionReport[]) {
  const complete = usableCompletionTimes(igdb)?.completionistSeconds;
  const votes: { provider: string; seconds: number }[] = reports.flatMap((report) => report.provider === "backloggd" && report.masterSeconds !== null
    ? [{ provider: report.provider as string, seconds: report.masterSeconds }] : []);
  if (complete) votes.push({ provider: "igdb", seconds: complete });
  return completionConsensus(votes);
}
