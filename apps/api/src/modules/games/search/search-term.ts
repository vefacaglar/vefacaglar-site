/**
 * Normalizes a public search box query. Returns null for blank or
 * punctuation-only input, which would otherwise match nearly every row.
 */
export function publicSearchTerm(q: string | undefined): string | null {
  const term = q?.trim().replace(/\s+/g, " ") ?? "";
  return /[\p{L}\p{N}]/u.test(term) ? term : null;
}
