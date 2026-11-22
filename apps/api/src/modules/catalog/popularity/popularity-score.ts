/** Current provider observations. Values are comparable only within one type. */
export const POPULARITY_TYPE = { VISITS: 1, PLAYING: 3, PLAYED: 4, STEAM_24H_PEAK_PLAYERS: 5 } as const;
export const REFRESHED_POPULARITY_TYPES: number[] = Object.values(POPULARITY_TYPE);
export const POPULARITY_RANKING_VERSION = "current-campaign-interest-v2";
export const POPULARITY_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const SINGLE_PLAYER_BONUS = 0.05;
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export type PopularitySignalKey = "visits" | "playing" | "played" | "steam24hPeak";
export const POPULARITY_WEIGHTS: Record<PopularitySignalKey, number> = { visits: 0.45, playing: 0.20, played: 0.20, steam24hPeak: 0.15 };
const SIGNAL_KEYS = Object.keys(POPULARITY_WEIGHTS) as PopularitySignalKey[];
export type GameFormatEvidence = { gameModeIds: number[] | null; keywordNames: string[]; hasStoryline: boolean };
export type WikipediaAudience = { sourceDate: string; currentViews: number; baselineViews: number };
export type PopularityInput = {
  id: string;
  singlePlayer?: boolean;
  signals: Partial<Record<PopularitySignalKey, number | null>>;
  format?: GameFormatEvidence;
  audience?: WikipediaAudience;
};

export function isCurrentPopularityObservation(calculatedAt: Date | null, now: number): boolean {
  const timestamp = calculatedAt?.getTime();
  return timestamp != null && Number.isFinite(timestamp) && timestamp >= now - POPULARITY_MAX_AGE_MS && timestamp <= now + CLOCK_TOLERANCE_MS;
}

// These are exact provider taxonomy concepts, independent of titles, genres and franchises.
const ONGOING_KEYWORDS = new Set(["never-ending", "esports", "ranked match", "professional gaming"]);
const CAMPAIGN_KEYWORDS = new Set(["campaign", "story rich", "linear gameplay", "multiple endings", "branching storyline"]);

/** Unknown coverage remains neutral; measured ongoing formats retain a positive floor. */
export function gameFormatAffinity(evidence?: GameFormatEvidence): number {
  if (!evidence) return 0.85;
  const modes = evidence.gameModeIds ?? [];
  const keywords = evidence.keywordNames.map((name) => name.trim().toLowerCase());
  const creatorPlatform = keywords.includes("user generated content") && keywords.includes("game creator") && modes.some((mode) => [2, 3, 5].includes(mode));
  const ongoing = creatorPlatform || modes.includes(5) || modes.includes(6) || keywords.some((name) => ONGOING_KEYWORDS.has(name));
  const campaign = keywords.some((name) => CAMPAIGN_KEYWORDS.has(name));
  if (ongoing) return campaign ? 0.60 : 0.35;
  if (campaign || (modes.includes(1) && evidence.hasStoryline) || (modes.length === 1 && modes[0] === 1)) return 1;
  return 0.85;
}

/**
 * Current activity qualifies a saturating audience base. Material incremental
 * human attention is confidence-shrunk and corroborated by gaming activity.
 * No age, review total, duration, title or private activity enters the score.
 */
export function computePopularityScores(games: PopularityInput[]): Map<string, number | null> {
  const peaks: Record<PopularitySignalKey, number> = { visits: 0, playing: 0, played: 0, steam24hPeak: 0 };
  let peakGrowth = 0;
  for (const game of games) {
    for (const key of SIGNAL_KEYS) {
      const value = game.signals[key];
      if (value != null && Number.isFinite(value) && value >= 0) peaks[key] = Math.max(peaks[key], value);
    }
    if (game.audience) peakGrowth = Math.max(peakGrowth, game.audience.currentViews - game.audience.baselineViews / 4);
  }
  const scores = new Map<string, number | null>();
  for (const game of games) {
    let observed = false;
    let gaming = 0;
    const normalized: Record<PopularitySignalKey, number> = { visits: 0, playing: 0, played: 0, steam24hPeak: 0 };
    for (const key of SIGNAL_KEYS) {
      const value = game.signals[key];
      if (value == null || !Number.isFinite(value) || value < 0) continue;
      observed = true;
      normalized[key] = peaks[key] > 0 ? Math.sqrt(value / peaks[key]) : 0;
      gaming += POPULARITY_WEIGHTS[key] * normalized[key];
    }
    if (!observed) { scores.set(game.id, null); continue; }
    if (gaming === 0) { scores.set(game.id, 0); continue; }
    const participating = normalized.playing > 0 || normalized.played > 0 || normalized.steam24hPeak > 0;
    let interest = 0.35 * gaming;
    const audience = game.audience;
    if (audience) {
      const weeklyBaseline = audience.baselineViews / 4;
      const growth = Math.max(0, audience.currentViews - weeklyBaseline);
      const confidence = growth / (growth + Math.max(1000, weeklyBaseline * 0.10));
      const incremental = peakGrowth > 0 ? Math.log1p(growth) / Math.log1p(peakGrowth) * confidence : 0;
      const corroboration = Math.sqrt(normalized.visits * Math.max(normalized.playing, normalized.steam24hPeak));
      const currentAudience = audience.currentViews / (audience.currentViews + 5000);
      interest = 0.70 * (0.50 * gaming + 0.50 * currentAudience) + 0.30 * incremental * corroboration;
    }
    // Absence of participation evidence reduces confidence without erasing fresh corroborated interest.
    const confidence = participating ? 1 : 0.50;
    const preference = game.singlePlayer ? 1 + SINGLE_PLAYER_BONUS : 1;
    scores.set(game.id, Math.max(0, Math.min(1, interest * gameFormatAffinity(game.format) * confidence * preference / (1 + SINGLE_PLAYER_BONUS))));
  }
  return scores;
}
