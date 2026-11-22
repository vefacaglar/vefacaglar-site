import type { GameCompletionTimesRow } from "./completion-times.types";

const PAGE_SIZE = 500;
const MAX_PAGES = 100;
type Query = (path: string, body: string) => Promise<unknown>;
const rawSeconds = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : null;

/** The complete provider feed is small. Publish only a complete, count-checked pass. */
export async function collectCompletionTimes(query: Query): Promise<GameCompletionTimesRow[]> {
  // A provider edit during paging can change the count. Retry the entire bounded
  // pass once, keeping the previously published data untouched in the meantime.
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await providerCount(query);
    const rows: GameCompletionTimesRow[] = [];
    const games = new Set<number>();
    let cursor = 0;
    let rawCount = 0;
    let finished = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const raw = await query("game_time_to_beats",
        `fields id,game_id,hastily,normally,completely,count,updated_at; where id>${cursor}; sort id asc; limit ${PAGE_SIZE};`);
      if (!Array.isArray(raw) || raw.length > PAGE_SIZE) throw new Error("Invalid IGDB completion times page");
      for (const row of raw) {
        if (!row || !Number.isSafeInteger(row.id) || row.id <= cursor || !Number.isSafeInteger(row.game_id) || row.game_id <= 0 ||
          !Number.isSafeInteger(row.count) || row.count < 0 || games.has(row.game_id)) {
          throw new Error("Malformed or duplicate IGDB completion times record");
        }
        cursor = row.id;
        rawCount++;
        games.add(row.game_id);
        const updatedAt = Number.isSafeInteger(row.updated_at) && row.updated_at > 0 ? new Date(row.updated_at * 1000) : null;
        rows.push({ sourceId: row.id, igdbId: row.game_id,
          hastilySeconds: rawSeconds(row.hastily), normallySeconds: rawSeconds(row.normally), completelySeconds: rawSeconds(row.completely),
          sampleCount: row.count, sourceUpdatedAt: updatedAt && Number.isFinite(updatedAt.getTime()) ? updatedAt : null });
      }
      if (raw.length < PAGE_SIZE) { finished = true; break; }
    }
    if (!finished) throw new Error("IGDB completion times pagination exceeded its bounded limit");
    const after = await providerCount(query);
    if (before === after && rawCount === after && rows.length > 0) return rows;
  }
  throw new Error("IGDB completion times changed or were incomplete; retaining the previous snapshot");
}

async function providerCount(query: Query): Promise<number> {
  const response = await query("game_time_to_beats/count", "") as { count?: number } | null;
  if (!response || !Number.isSafeInteger(response.count) || response.count! <= 0 || response.count! > PAGE_SIZE * MAX_PAGES) {
    throw new Error("IGDB completion times count is empty or invalid");
  }
  return response.count!;
}
