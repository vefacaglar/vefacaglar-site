import { MAX_COMPLETION_SECONDS } from "./completion-times-quality";

export type CompletionVote = { provider: string; seconds: number };
export type CompletionConsensus = {
  kind: "single" | "agreement" | "range";
  estimateSeconds: number | null;
  lowerSeconds: number;
  upperSeconds: number;
  providers: string[];
  excludedProviders: string[];
};

/** Pairwise agreement. A majority cannot form through a chain of disagreeing endpoints. */
const agree = (a: number, b: number) => Math.abs(a - b) <= Math.max(60, Math.min(a, b) * 0.2);

export function completionConsensus(raw: CompletionVote[]): CompletionConsensus | null {
  const byProvider = new Map<string, Set<number>>();
  for (const vote of raw) {
    if (!vote.provider || !Number.isFinite(vote.seconds) || vote.seconds <= 0 || vote.seconds > MAX_COMPLETION_SECONDS) continue;
    const values = byProvider.get(vote.provider) ?? new Set<number>();
    values.add(vote.seconds);
    byProvider.set(vote.provider, values);
  }
  // A provider with conflicting duplicates has no unambiguous vote.
  const votes = [...byProvider].filter(([, values]) => values.size === 1)
    .map(([provider, values]) => ({ provider, seconds: [...values][0] }))
    .sort((a, b) => a.seconds - b.seconds || a.provider.localeCompare(b.provider));
  if (!votes.length) return null;
  if (votes.length === 1) return { kind: "single", estimateSeconds: votes[0].seconds,
    lowerSeconds: votes[0].seconds, upperSeconds: votes[0].seconds, providers: [votes[0].provider], excludedProviders: [] };

  let largest: CompletionVote[][] = [];
  let size = 0;
  for (let start = 0; start < votes.length; start++) {
    let end = start;
    while (end + 1 < votes.length && agree(votes[start].seconds, votes[end + 1].seconds)) end++;
    const cluster = votes.slice(start, end + 1);
    if (cluster.length > size) { largest = [cluster]; size = cluster.length; }
    else if (cluster.length === size) largest.push(cluster);
  }
  if (largest.length === 1 && size > votes.length / 2) {
    const cluster = largest[0];
    const included = new Set(cluster.map((vote) => vote.provider));
    return { kind: "agreement", estimateSeconds: Math.round(cluster.reduce((total, vote) => total + vote.seconds, 0) / size),
      lowerSeconds: cluster[0].seconds, upperSeconds: cluster[cluster.length - 1].seconds,
      providers: [...included].sort(), excludedProviders: votes.filter((vote) => !included.has(vote.provider)).map((vote) => vote.provider).sort() };
  }
  return { kind: "range", estimateSeconds: null, lowerSeconds: votes[0].seconds, upperSeconds: votes[votes.length - 1].seconds,
    providers: votes.map((vote) => vote.provider).sort(), excludedProviders: [] };
}
