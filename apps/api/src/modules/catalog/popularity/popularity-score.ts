/**
 * IGDB popularity type ids (POST /v4/popularity_types). Values are only
 * comparable within one type, so each is normalized on its own before blending.
 */
export const POPULARITY_TYPE = {
  VISITS: 1,
  PLAYING: 3,
  STEAM_24H_PEAK_PLAYERS: 5,
} as const;

/** The IGDB popularity types the refresh fetches and stores. */
export const REFRESHED_POPULARITY_TYPES: number[] = [
  POPULARITY_TYPE.VISITS,
  POPULARITY_TYPE.PLAYING,
  POPULARITY_TYPE.STEAM_24H_PEAK_PLAYERS,
];

export type PopularitySignalKey = "visits" | "playing" | "steam24hPeak";

/** Our current-interest blend, not IGDB's undocumented homepage ranking formula. */
export const POPULARITY_WEIGHTS: Record<PopularitySignalKey, number> = {
  visits: 0.70,
  playing: 0.20,
  steam24hPeak: 0.10,
};

const SIGNAL_KEYS = Object.keys(POPULARITY_WEIGHTS) as PopularitySignalKey[];

/** A game's raw signal values; a missing (undefined/null) signal is unknown, not zero. */
export type PopularityInput = {
  id: string;
  singlePlayer?: boolean;
  signals: Partial<Record<PopularitySignalKey, number | null>>;
};

/** IGDB publishes these signals daily. Allow two delayed daily runs. */
export const POPULARITY_MAX_AGE_MS = 72 * 60 * 60 * 1000;
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export function isCurrentPopularityObservation(calculatedAt: Date | null, now: number): boolean {
  const timestamp = calculatedAt?.getTime();
  return timestamp != null && Number.isFinite(timestamp)
    && timestamp >= now - POPULARITY_MAX_AGE_MS && timestamp <= now + CLOCK_TOLERANCE_MS;
}

/** A small relative preference only changes games with similar current interest. */
export const SINGLE_PLAYER_BONUS = 0.05;

/**
 * Normalize each signal against its observed peak, retaining differences in
 * audience size. Square roots soften extreme peaks without turning a tiny
 * audience into a near-maximal percentile. Fixed weights bound each signal's
 * contribution even when the other measurements are unavailable.
 */
export function computePopularityScores(games: PopularityInput[]): Map<string, number | null> {
  const peaks: Record<PopularitySignalKey, number> = { visits: 0, playing: 0, steam24hPeak: 0 };
  for (const game of games) {
    for (const key of SIGNAL_KEYS) {
      const value = game.signals[key];
      if (value != null && Number.isFinite(value) && value >= 0) peaks[key] = Math.max(peaks[key], value);
    }
  }

  const scores = new Map<string, number | null>();
  for (const game of games) {
    let weighted = 0;
    let observed = false;
    for (const key of SIGNAL_KEYS) {
      const value = game.signals[key];
      if (value == null || !Number.isFinite(value) || value < 0) continue;
      observed = true;
      weighted += POPULARITY_WEIGHTS[key] * (peaks[key] > 0 ? Math.sqrt(value / peaks[key]) : 0);
    }
    const preference = game.singlePlayer ? 1 + SINGLE_PLAYER_BONUS : 1;
    scores.set(game.id, observed ? weighted * preference / (1 + SINGLE_PLAYER_BONUS) : null);
  }
  return scores;
}
