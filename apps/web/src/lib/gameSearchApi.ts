import { cache } from "react";
import { httpClient } from "./httpClient";
import {
  EMPTY_GAME_SUGGESTIONS,
  gameSearchTerm,
  parseGameSuggestions,
  type GameSearchCompanies,
  type GameSuggestions,
} from "./gameSearch";

/** Server-only: suggestions for the games search box, proxied by /api/games/suggest. */
export async function fetchGameSuggestions(q: string | null | undefined, signal?: AbortSignal): Promise<GameSuggestions> {
  const term = gameSearchTerm(q);
  if (!term) return EMPTY_GAME_SUGGESTIONS;
  const response = await httpClient.get(`/api/games/search/suggest?${new URLSearchParams({ q: term })}`, { signal });
  if (!response.ok) throw new Error(`Game suggestions fetch failed: ${response.status}`);
  return parseGameSuggestions(await response.json());
}

/**
 * Developers and publishers matching a games search, shown above the grid.
 * Request-scoped only; a failure hides the sections instead of failing the page.
 */
export const getGameSearchCompanies = cache(async (q: string): Promise<GameSearchCompanies> => {
  const empty = { developers: [], publishers: [] };
  const term = gameSearchTerm(q);
  if (!term) return empty;
  try {
    const response = await httpClient.get(`/api/games/search/companies?${new URLSearchParams({ q: term, limit: "12" })}`);
    if (!response.ok) return empty;
    const { developers, publishers } = parseGameSuggestions(await response.json());
    return { developers, publishers };
  } catch {
    return empty;
  }
});
