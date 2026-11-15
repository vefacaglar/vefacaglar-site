import { cache } from "react";
import { httpClient } from "./httpClient";
import {
  EMPTY_GAME_SUGGESTIONS,
  gameSearchTerm,
  parseGameSuggestions,
  GAME_SUGGESTION_GROUPS,
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

/** Developers and publishers matching a games search, plus the best-first order of those sections and the games grid. */
export type GameSearchSections = Pick<GameSuggestions, "developers" | "publishers" | "order">;

/**
 * Developers and publishers matching a games search, with the section order.
 * Request-scoped only; a failure hides the company sections and keeps the default order.
 */
export const getGameSearchCompanies = cache(async (q: string): Promise<GameSearchSections> => {
  const empty = { developers: [], publishers: [], order: GAME_SUGGESTION_GROUPS };
  const term = gameSearchTerm(q);
  if (!term) return empty;
  try {
    const response = await httpClient.get(`/api/games/search/companies?${new URLSearchParams({ q: term, limit: "12" })}`);
    if (!response.ok) return empty;
    const { developers, publishers, order } = parseGameSuggestions(await response.json());
    return { developers, publishers, order };
  } catch {
    return empty;
  }
});
