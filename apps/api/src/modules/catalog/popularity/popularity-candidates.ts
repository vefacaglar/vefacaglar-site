import type { PopularityPrimitive } from "../import/import.types";
import { POPULARITY_TYPE } from "./popularity-score";

/** At most 450 current leaders, with fixed source coverage and deterministic ties. */
export function popularityCandidateIds(primitives: PopularityPrimitive[]): number[] {
  const selected = new Set<number>();
  const leaders = [[POPULARITY_TYPE.VISITS, 200], [POPULARITY_TYPE.PLAYING, 100], [POPULARITY_TYPE.PLAYED, 100], [POPULARITY_TYPE.STEAM_24H_PEAK_PLAYERS, 50]]
    .map(([type, limit]) => primitives.filter((row) => row.popularityType === type && row.value > 0)
      .sort((a, b) => b.value - a.value || a.igdbId - b.igdbId).slice(0, limit));
  // Interleave sources so a request budget cannot starve console or Steam coverage.
  for (let index = 0; index < 200; index++) {
    for (const source of leaders) if (source[index]) selected.add(source[index].igdbId);
  }
  return [...selected];
}
