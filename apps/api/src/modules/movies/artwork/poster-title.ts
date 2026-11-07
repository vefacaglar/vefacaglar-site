/** Only compare explicit terminal sequel numbers on the same alphabetic title. */
export function hasConflictingSequelNumber(movieTitle: string | null, articleTitle: string | null): boolean {
  const suffix = (title: string | null) => {
    if (!title) return null;
    const bare = title.normalize("NFKC").trim().replace(/\s*\((?:\d{4}\s+)?film\)\s*$/i, "").trim();
    const match = /^(.*?)\s+([1-9]\d?)$/.exec(bare);
    if (!match || /\p{N}/u.test(match[1])) return null;
    const base = match[1].normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}]+/gu, " ").trim().replace(/\s+/g, " ");
    return base ? { base, number: Number(match[2]) } : null;
  };
  const movie = suffix(movieTitle);
  const article = suffix(articleTitle);
  return !!movie && !!article && movie.base === article.base && movie.number !== article.number;
}
