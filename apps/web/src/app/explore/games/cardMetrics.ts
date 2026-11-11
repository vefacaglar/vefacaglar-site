type ReviewScoreInput = {
  metacriticScore?: number | null;
  openCriticScore?: number | null;
  /** The API already applies its minimum review count to this IGDB aggregate. */
  criticScore?: number | null;
};

export type ReviewScore = {
  source: "Metacritic" | "OpenCritic" | "IGDB Critics";
  value: number;
};

/** Use named provider scores when present, otherwise the separately labelled IGDB aggregate. */
export function selectReviewScores(game: ReviewScoreInput): ReviewScore[] {
  const scores: ReviewScore[] = [];
  if (isReviewScore(game.metacriticScore)) scores.push({ source: "Metacritic", value: game.metacriticScore });
  if (isReviewScore(game.openCriticScore)) scores.push({ source: "OpenCritic", value: game.openCriticScore });
  if (scores.length === 0 && isReviewScore(game.criticScore)) scores.push({ source: "IGDB Critics", value: game.criticScore });
  return scores;
}

export function formatReviewScore(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

function isReviewScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
