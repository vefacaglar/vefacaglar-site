/** Scores averaged from fewer critic reviews than this are too noisy to show. */
export const MIN_CRITIC_REVIEWS = 3;

/** The critic score to show publicly, or null when it rests on too few reviews. */
export function publicCriticScore(score: number | null, count: number | null): number | null {
  return score !== null && (count ?? 0) >= MIN_CRITIC_REVIEWS ? score : null;
}
