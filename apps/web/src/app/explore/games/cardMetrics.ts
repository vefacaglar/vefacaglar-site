type ReviewScoreInput = {
  /** The API already applies its minimum review count to this IGDB aggregate. */
  criticScore?: number | null;
};

export type ReviewScore = {
  source: "IGDB Critics";
  value: number;
};

/** Use the separately labelled IGDB aggregate score. */
export function selectReviewScores(game: ReviewScoreInput): ReviewScore[] {
  if (isReviewScore(game.criticScore)) {
    return [{ source: "IGDB Critics", value: game.criticScore }];
  }
  return [];
}

export function formatReviewScore(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

function isReviewScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
