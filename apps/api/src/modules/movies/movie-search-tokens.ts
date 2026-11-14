/** Lowercased letter/digit runs, capped at 8. Empty for blank or punctuation-only input. */
export function movieSearchTokens(q: string | undefined): string[] {
  return q?.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
}
