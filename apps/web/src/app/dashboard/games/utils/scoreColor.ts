type ScoreClassModule = {
  scoreHigh: string;
  scoreMid: string;
};

export function getScoreColorClass(score: number | null, styles: ScoreClassModule): string {
  if (!score) return "";
  if (score >= 90) return styles.scoreHigh;
  if (score >= 75) return styles.scoreMid;
  return "";
}
