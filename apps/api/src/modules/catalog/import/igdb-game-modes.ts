/** IGDB omits an empty game_modes field; malformed responses never become "none". */
export function parseGameModeIds(raw: unknown): number[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((mode) => !Number.isSafeInteger(mode) || mode <= 0)) {
    throw new Error("IGDB returned malformed game modes");
  }
  return [...new Set(raw as number[])].sort((a, b) => a - b);
}

export function parseGameModeRows(raw: unknown, requestedIds: number[]): { igdbId: number; gameModeIds: number[] }[] {
  if (!Array.isArray(raw) || raw.length > requestedIds.length) throw new Error("IGDB returned an invalid game-mode batch");
  const requested = new Set(requestedIds);
  const seen = new Set<number>();
  return raw.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("IGDB returned an invalid game-mode row");
    const value = row as Record<string, unknown>;
    if (!Number.isSafeInteger(value.id) || !requested.has(value.id as number) || seen.has(value.id as number)) {
      throw new Error("IGDB returned an unexpected or duplicate game-mode row");
    }
    seen.add(value.id as number);
    return { igdbId: value.id as number, gameModeIds: parseGameModeIds(value.game_modes) };
  });
}
