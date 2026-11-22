/** Diversify the persisted ranking head while keeping the entire tail unchanged. */
export const SERIES_BALANCE_HEAD_SIZE = 60;
const REPEATED_SERIES_STEP = 0.10;
const MIN_SERIES_FACTOR = 0.65;

type RankedGame = { id: string; score: number };
const rankOrder = (left: RankedGame, right: RankedGame) => right.score - left.score || left.id.localeCompare(right.id, "en");

export function diversifySeriesHead(
  scores: Map<string, number | null>,
  primarySeries: Map<string, number | null>
): Map<string, number | null> {
  const ranked = [...scores].flatMap(([id, score]) => score !== null && Number.isFinite(score) && score > 0 ? [{ id, score }] : []).sort(rankOrder);
  const boundary = ranked[SERIES_BALANCE_HEAD_SIZE]?.score ?? 0;
  // A tied boundary block stays intact. No arbitrary subset receives a discount.
  const head = ranked.slice(0, SERIES_BALANCE_HEAD_SIZE).filter((game) => game.score > boundary);
  if (head.length === 0) return new Map(scores);
  const seen = new Map<number, number>();
  let repeated = false;
  const adjusted = head.map((game) => {
    const series = primarySeries.get(game.id);
    if (series == null || !Number.isSafeInteger(series) || series <= 0) return game;
    const ordinal = (seen.get(series) ?? 0) + 1;
    seen.set(series, ordinal);
    if (ordinal <= 2) return game;
    repeated = true;
    const factor = Math.max(MIN_SERIES_FACTOR, 1 - REPEATED_SERIES_STEP * (ordinal - 2));
    return { id: game.id, score: game.score * factor };
  }).sort(rankOrder);
  if (!repeated) return new Map(scores);
  // Encode this ordering into canonical scores. A tiny strict floor prevents
  // undiscounted tail siblings and numeric ties from undoing the head order.
  const epsilon = Number.EPSILON * Math.max(1, head[0].score) * 4;
  if (head[0].score - boundary <= epsilon * (head.length + 1)) return new Map(scores);
  const result = new Map(scores);
  let previous = Infinity;
  for (const [index, game] of adjusted.entries()) {
    const floor = boundary + epsilon * (adjusted.length - index);
    const effective = Math.min(Math.max(game.score, floor), previous - epsilon);
    result.set(game.id, effective);
    previous = effective;
  }
  return result;
}
