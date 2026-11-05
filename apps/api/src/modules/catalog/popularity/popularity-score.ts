/**
 * IGDB popularity type ids (POST /v4/popularity_types). Values are only
 * comparable within one type, so each is ranked on its own before blending.
 */
export const POPULARITY_TYPE = {
  WANT_TO_PLAY: 2,
  PLAYED: 4,
  STEAM_TOTAL_REVIEWS: 8,
} as const;

/** The IGDB popularity types the refresh fetches and stores. */
export const REFRESHED_POPULARITY_TYPES: number[] = [
  POPULARITY_TYPE.WANT_TO_PLAY,
  POPULARITY_TYPE.PLAYED,
  POPULARITY_TYPE.STEAM_TOTAL_REVIEWS,
];

export type PopularitySignalKey = "played" | "steamReviews" | "ratingCount" | "wantToPlay" | "hltbEngagement";

export const POPULARITY_WEIGHTS: Record<PopularitySignalKey, number> = {
  played: 0.28,
  steamReviews: 0.20,
  ratingCount: 0.20,
  wantToPlay: 0.12,
  hltbEngagement: 0.20,
};

const SIGNAL_KEYS = Object.keys(POPULARITY_WEIGHTS) as PopularitySignalKey[];

/** A game's raw signal values; a missing (undefined/null) signal is unknown, not zero. */
export type PopularityInput = {
  id: string;
  signals: Partial<Record<PopularitySignalKey, number | null>>;
};

/**
 * Percentile rank (0-1) of each value among all values, in input order. Ties
 * share their mid-rank, so equal values always score equally. A single value ranks 1.
 */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array<number>(n);
  for (let start = 0; start < n; ) {
    let end = start;
    while (end + 1 < n && values[order[end + 1]] === values[order[start]]) end++;
    const rank = (start + end) / 2 / (n - 1);
    for (let k = start; k <= end; k++) ranks[order[k]] = rank;
    start = end + 1;
  }
  return ranks;
}

/**
 * Blends each game's signals into one 0-1 score: every signal is log1p'd and
 * percentile-ranked across the catalog, then averaged with POPULARITY_WEIGHTS
 * re-normalized over the signals the game actually has. No signals → null.
 */
export function computePopularityScores(games: PopularityInput[]): Map<string, number | null> {
  const ranked = new Map<string, Partial<Record<PopularitySignalKey, number>>>();
  for (const game of games) ranked.set(game.id, {});

  for (const key of SIGNAL_KEYS) {
    const present = games.filter((g) => g.signals[key] != null && Number.isFinite(g.signals[key]) && g.signals[key]! >= 0);
    const ranks = percentileRanks(present.map((g) => Math.log1p(Math.max(0, g.signals[key]!))));
    present.forEach((g, i) => {
      ranked.get(g.id)![key] = ranks[i];
    });
  }

  const scores = new Map<string, number | null>();
  for (const game of games) {
    const ranks = ranked.get(game.id)!;
    let weighted = 0;
    let weightSum = 0;
    for (const key of SIGNAL_KEYS) {
      const rank = ranks[key];
      if (rank === undefined) continue;
      weighted += POPULARITY_WEIGHTS[key] * rank;
      weightSum += POPULARITY_WEIGHTS[key];
    }
    scores.set(game.id, weightSum > 0 ? weighted / weightSum : null);
  }
  return scores;
}
