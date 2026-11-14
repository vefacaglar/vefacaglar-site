// Client-safe: must not import modules that pull in httpClient (e.g. ./gameCompanies).

/** Mirrors the API's search box limits. */
export const GAME_SEARCH_MAX_LENGTH = 100;
export const GAME_SUGGEST_MIN_LENGTH = 2;

export interface GameSearchCompany {
  name: string;
  slug: string;
  gameCount: number;
}

export interface GameSearchCompanies {
  developers: GameSearchCompany[];
  publishers: GameSearchCompany[];
}

export interface GameSuggestionItem {
  slug: string;
  title: string;
  releaseYear: number | null;
  developer: string | null;
}

export interface GameSuggestions extends GameSearchCompanies {
  games: GameSuggestionItem[];
}

export type GameSuggestionGroup = "developers" | "publishers" | "games";

/** One selectable dropdown row; `href` is unlocalized. */
export type GameSuggestionOption =
  | { group: "developers" | "publishers"; key: string; href: string; company: GameSearchCompany }
  | { group: "games"; key: string; href: string; game: GameSuggestionItem };

export const EMPTY_GAME_SUGGESTIONS: GameSuggestions = { developers: [], publishers: [], games: [] };

/** Dropdown order: Developers, Publishers, Games. */
export const GAME_SUGGESTION_GROUPS: GameSuggestionGroup[] = ["developers", "publishers", "games"];

/** Trims and collapses whitespace; null when the query has no letter or digit to search for. */
export function gameSearchTerm(value: string | null | undefined): string | null {
  const term = (value ?? "").trim().replace(/\s+/g, " ").slice(0, GAME_SEARCH_MAX_LENGTH);
  return /[\p{L}\p{N}]/u.test(term) ? term : null;
}

export function gameHref(slug: string): string {
  return `/explore/games/${encodeURIComponent(slug)}`;
}

/** Same path as `gameCompanyHref`; the group name is the route segment. */
export function gameCompanyGroupHref(group: "developers" | "publishers", slug: string): string {
  return `/explore/games/${group}/${encodeURIComponent(slug)}`;
}

/** Flattens grouped suggestions into the keyboard order of the dropdown. */
export function gameSuggestionOptions(suggestions: GameSuggestions): GameSuggestionOption[] {
  return GAME_SUGGESTION_GROUPS.flatMap((group): GameSuggestionOption[] =>
    group === "games"
      ? suggestions.games.map((game) => ({ group, key: `games:${game.slug}`, href: gameHref(game.slug), game }))
      : suggestions[group].map((company) => ({
          group,
          key: `${group}:${company.slug}`,
          href: gameCompanyGroupHref(group, company.slug),
          company,
        })),
  );
}

/** Keeps only well-formed groups, so a malformed response degrades to an empty dropdown. */
export function parseGameSuggestions(data: unknown): GameSuggestions {
  const value = (data ?? {}) as Partial<Record<GameSuggestionGroup, unknown>>;
  const list = <T,>(items: unknown): T[] => (Array.isArray(items) ? (items as T[]) : []);
  return {
    developers: list<GameSearchCompany>(value.developers),
    publishers: list<GameSearchCompany>(value.publishers),
    games: list<GameSuggestionItem>(value.games),
  };
}
