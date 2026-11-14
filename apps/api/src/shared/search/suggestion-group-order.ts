/**
 * Orders search-box suggestion groups (e.g. people vs. movies) by how well each
 * group's best suggestion matches the query.
 *
 * Raw Meilisearch `_rankingScore` values are not comparable across indexes: each
 * index has different ranking rules (movies_en has no exactness, games_en and the
 * lookups rank exactness, movie_people_en ends with popularity), so "megan" scores
 * 1.0 on "Megan Leavey" but 0.985 on "Megan Fox". The comparable parts of a match
 * (every query word found, no typo, the whole name typed) are read from the text
 * the dropdown shows instead, which also works for the PostgreSQL fallback.
 *
 * A group's score is its best suggestion's, compared in this order:
 * 1. Match tier: the whole text equals the query (4); every query word is a whole
 *    word of the text (3); every query word starts a word of the text (2); every
 *    query word is within a typo budget of a text word, or of the same-length start
 *    of one for prefix typing (1); anything else, such as a split-word match (0).
 *    The typo budget mirrors Meilisearch's defaults: 0 edits below 5 letters, 1 for
 *    5-8, 2 from 9, where an adjacent swap counts as one edit. Without this tier,
 *    every typo query would tie at 0 and the name groups would win by input order.
 * 2. Coverage: the share of the text's words the query matched, so "Cargo" beats
 *    "Cargo 200" and "Megan Fox" (1 of 2) beats "Megan Is Missing" (1 of 3).
 * 3. Start: the text begins with the query's first word, so "Halo 3" beats the
 *    developer "Twins Halo" (Meilisearch's wordPosition idea).
 * 4. Ties keep the order the groups are passed in. Callers list name groups
 *    (people, companies) before title groups, because titles often borrow a name
 *    ("Megan Leavey", "Bethesda Pinball") while a name rarely borrows a title.
 * Empty groups go last.
 */

export interface SuggestionGroupInput<K extends string> {
  key: K;
  /** Display text of each suggestion in the group (titles or names). */
  texts: readonly string[];
}

export interface SuggestionMatch {
  tier: 0 | 1 | 2 | 3 | 4;
  coverage: number;
  start: boolean;
}

const NO_MATCH: SuggestionMatch = { tier: 0, coverage: 0, start: false };

/** Lowercased letter/digit runs with diacritics removed ("Pokémon" -> ["pokemon"]). */
function words(text: string): string[] {
  return text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Damerau-Levenshtein distance (optimal string alignment): an adjacent swap is one edit. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Query word `q` matches `word` within the typo budget, as a whole word or as its same-length start. */
function fuzzyMatches(word: string, q: string): boolean {
  const budget = q.length < 5 ? 0 : q.length < 9 ? 1 : 2;
  return editDistance(q, word) <= budget || editDistance(q, word.slice(0, q.length)) <= budget;
}

/** How well one suggestion's text matches the query. */
export function suggestionMatch(query: string, text: string): SuggestionMatch {
  const queryWords = words(query);
  const textWords = words(text);
  if (!queryWords.length || !textWords.length) return NO_MATCH;
  if (queryWords.join(" ") === textWords.join(" ")) return { tier: 4, coverage: 1, start: true };

  const whole = queryWords.every((q) => textWords.includes(q));
  const prefix = queryWords.every((q) => textWords.some((w) => w.startsWith(q)));
  const fuzzy = !whole && !prefix;
  if (fuzzy && !queryWords.every((q) => textWords.some((w) => fuzzyMatches(w, q)))) return NO_MATCH;
  const matches = (word: string, q: string) => (whole ? word === q : fuzzy ? fuzzyMatches(word, q) : word.startsWith(q));
  const matched = textWords.filter((w) => queryWords.some((q) => matches(w, q))).length;
  return { tier: whole ? 3 : prefix ? 2 : 1, coverage: matched / textWords.length, start: matches(textWords[0], queryWords[0]) };
}

function compare(a: SuggestionMatch, b: SuggestionMatch): number {
  return a.tier - b.tier || a.coverage - b.coverage || Number(a.start) - Number(b.start);
}

/** Group keys, best-matching group first; ties and empty groups keep the given order. */
export function orderSuggestionGroups<K extends string>(query: string, groups: readonly SuggestionGroupInput<K>[]): K[] {
  return groups
    .map((group, index) => ({
      key: group.key,
      index,
      empty: group.texts.length === 0,
      best: group.texts.map((text) => suggestionMatch(query, text)).reduce((a, b) => (compare(b, a) > 0 ? b : a), NO_MATCH),
    }))
    .sort((a, b) => Number(a.empty) - Number(b.empty) || compare(b.best, a.best) || a.index - b.index)
    .map((group) => group.key);
}
