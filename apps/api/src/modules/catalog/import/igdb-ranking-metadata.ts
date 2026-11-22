import type { GameRankingMetadata } from "./import.types";
import { parseGameModeIds } from "./igdb-game-modes";
import { wikipediaGameArticle } from "../popularity/wikipedia-audience";

/** Use a unique most-specific official Series; ambiguous memberships remain unknown. */
function primarySeriesId(raw: unknown): number | null {
  if (raw == null) return null;
  if (!Array.isArray(raw) || raw.length > 100) throw new Error("Invalid IGDB collections");
  const seriesIds = new Set<number>();
  const parentIds = new Set<number>();
  for (const row of raw) {
    if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || (row.type !== undefined && (!Number.isSafeInteger(row.type) || row.type <= 0))) {
      throw new Error("Invalid IGDB collection identity");
    }
    if (row.type !== 1) continue; // Official collection_types id 1 is Series.
    if (seriesIds.has(row.id)) throw new Error("Duplicate IGDB collection identity");
    seriesIds.add(row.id);
    const relations = row.as_child_relations ?? [];
    if (!Array.isArray(relations) || relations.length > 100) throw new Error("Invalid IGDB collection relations");
    for (const relation of relations) {
      if (!relation || !Number.isSafeInteger(relation.parent_collection) || relation.parent_collection <= 0) throw new Error("Invalid IGDB parent collection");
      parentIds.add(relation.parent_collection);
    }
  }
  const mostSpecific = [...seriesIds].filter((id) => !parentIds.has(id));
  return mostSpecific.length === 1 ? mostSpecific[0] : null;
}

export function parseRankingMetadata(raw: unknown, ids: number[]): GameRankingMetadata[] {
  if (!Array.isArray(raw) || raw.length > ids.length) throw new Error("Invalid IGDB ranking metadata batch");
  const requested = new Set(ids);
  const seen = new Set<number>();
  return raw.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Invalid IGDB ranking metadata row");
    const value = row as Record<string, unknown>;
    if (!Number.isSafeInteger(value.id) || !requested.has(Number(value.id)) || seen.has(Number(value.id))
      || (value.storyline !== undefined && typeof value.storyline !== "string")) throw new Error("Invalid IGDB ranking identity");
    seen.add(Number(value.id));
    const keywords = value.keywords ?? [];
    const websites = value.websites ?? [];
    if (!Array.isArray(keywords) || keywords.length > 1000 || keywords.some((item) => !item || typeof item.name !== "string" || item.name.length > 250)
      || !Array.isArray(websites) || websites.length > 100 || websites.some((item) => !item || typeof item.url !== "string")) {
      throw new Error("Invalid IGDB ranking taxonomy");
    }
    const articles = websites.map((item) => wikipediaGameArticle(item.url)).filter((article): article is string => article !== null);
    return { igdbId: Number(value.id), gameModeIds: value.game_modes === undefined ? null : parseGameModeIds(value.game_modes),
      keywordNames: keywords.map((item) => item.name), hasStoryline: typeof value.storyline === "string" && value.storyline.trim().length > 0,
      wikipediaArticle: [...new Set(articles)].sort()[0] ?? null, primarySeriesId: primarySeriesId(value.collections) };
  });
}
