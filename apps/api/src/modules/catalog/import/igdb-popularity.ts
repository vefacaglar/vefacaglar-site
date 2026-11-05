import type { PopularityPrimitive } from "./import.types";

export const POPULARITY_PAGE_SIZE = 500;
// Far above the current ~245,000 rows; protects against an endlessly changing/broken feed.
const MAX_PAGES = 10_000;

type PopularityPage = { primitives: PopularityPrimitive[]; nextId: number; done: boolean };

/** Global pagination must advance on raw primitive ids, including games outside our catalog. */
export async function readPopularityPages(
  popularityTypes: number[],
  loadPage: (query: string) => Promise<unknown>
): Promise<PopularityPrimitive[]> {
  if (popularityTypes.length === 0) return [];
  if (popularityTypes.some((type) => !Number.isSafeInteger(type) || type <= 0)) {
    throw new Error("Invalid IGDB popularity types");
  }
  const types = [...new Set(popularityTypes)];
  const out: PopularityPrimitive[] = [];
  let cursor = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const raw = await loadPage(
      `fields id,game_id,value,popularity_type,calculated_at; where popularity_type = (${types.join(",")}) & id > ${cursor}; sort id asc; limit ${POPULARITY_PAGE_SIZE};`
    );
    const parsed = parsePopularityPage(raw, cursor, types);
    out.push(...parsed.primitives);
    if (parsed.done) {
      if (out.length === 0) throw new Error("IGDB returned no current popularity data");
      return out;
    }
    cursor = parsed.nextId;
  }
  throw new Error("IGDB popularity pagination exceeded its safe page limit");
}

/** Reject malformed/non-advancing pages before the caller can replace last good data. */
export function parsePopularityPage(raw: unknown, cursor: number, popularityTypes: number[]): PopularityPage {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || !Array.isArray(raw) || raw.length > POPULARITY_PAGE_SIZE) {
    throw new Error("IGDB returned an invalid popularity page");
  }
  const primitives: PopularityPrimitive[] = [];
  let nextId = cursor;
  for (const row of raw) {
    if (!row || typeof row !== "object" ||
      !Number.isSafeInteger(row.id) || row.id <= nextId ||
      !Number.isSafeInteger(row.game_id) || row.game_id <= 0 ||
      !popularityTypes.includes(row.popularity_type) ||
      typeof row.value !== "number" || !Number.isFinite(row.value) || row.value < 0 ||
      (row.calculated_at != null && (!Number.isSafeInteger(row.calculated_at) || row.calculated_at < 0))) {
      throw new Error("IGDB returned malformed or non-advancing popularity data");
    }
    const calculatedAt = row.calculated_at ? new Date(row.calculated_at * 1000) : null;
    if (calculatedAt && !Number.isFinite(calculatedAt.getTime())) throw new Error("IGDB returned an invalid popularity timestamp");
    nextId = row.id;
    primitives.push({ igdbId: row.game_id, popularityType: row.popularity_type, value: row.value, calculatedAt });
  }
  return { primitives, nextId, done: raw.length < POPULARITY_PAGE_SIZE };
}
