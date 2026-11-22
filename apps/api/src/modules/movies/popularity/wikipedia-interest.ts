import { MOVIE_INTEREST_SOURCE_URL, MovieInterestSourceError, type InterestArticle, type InterestProjection, type MovieRanking } from "./popularity.types";
const DAY = 86_400_000;
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
export function utcDay(now = new Date()): string { return now.toISOString().slice(0, 10); }
export function isSourceDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}
export function candidateSourceDays(after: string | null, now = new Date()): string[] {
  if (after !== null && !isSourceDay(after)) throw new Error("invalid_popularity_state_date");
  const today = Date.parse(utcDay(now) + "T00:00:00Z");
  return [1, 2, 3].map((days) => new Date(today - days * DAY).toISOString().slice(0, 10)).filter((day) => after === null || day > after);
}
export function sourceIsFresh(day: string | null, now = new Date()): boolean {
  if (!isSourceDay(day)) return false;
  const today = Date.parse(utcDay(now) + "T00:00:00Z");
  const observed = Date.parse(day + "T00:00:00Z");
  return observed < today && observed >= today - 7 * DAY;
}
export function sourceUrl(day: string): string {
  if (!isSourceDay(day)) throw new Error("invalid_source_date");
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access/${day.replace(/-/g, "/")}`;
}
export function movieRanking(day: string | null, now = new Date(), hasObservations = true): MovieRanking {
  const isFresh = sourceIsFresh(day, now) && hasObservations;
  return { mode: isFresh ? "wikipedia_interest" : "recognition", sourceDate: day, sourceUrl: day && isSourceDay(day) ? MOVIE_INTEREST_SOURCE_URL : null, isFresh, windowDays: 3 };
}
export function snapshotDisposition(incoming: string, accepted: string | null, now = new Date()): "publish" | "unchanged" {
  if (!isSourceDay(incoming) || incoming >= utcDay(now)) throw new Error("invalid_observation_day");
  if (accepted && incoming < accepted) throw new Error("stale_popularity_projection");
  return incoming === accepted ? "unchanged" : "publish";
}
export function normalizeArticleTitle(title: string): string { return title.normalize("NFC").replace(/_/g, " ").replace(/\s+/g, " ").trim(); }
export function parseTopArticles(raw: unknown, day: string): InterestArticle[] {
  const bad = (reason: string) => new MovieInterestSourceError("aqs", `aqs_invalid_complete_projection_${reason}`);
  if (!isSourceDay(day) || !object(raw) || !Array.isArray(raw.items) || raw.items.length !== 1) throw bad("envelope");
  const item = raw.items[0];
  if (!object(item) || !["en.wikipedia", "en.wikipedia.org"].includes(item.project) || item.access !== "all-access") throw bad("project");
  if (`${item.year}-${item.month}-${item.day}` !== day) throw bad("period");
  if (!Array.isArray(item.articles) || item.articles.length !== 1000) throw bad("count");
  const titles = new Set<string>();
  return item.articles.map((entry: unknown) => {
    if (!object(entry) || typeof entry.article !== "string" || !entry.article.trim() || entry.article.length > 512) throw bad("title");
    if (!Number.isSafeInteger(entry.views) || entry.views < 0 || entry.views > 2_147_483_647) throw bad("views");
    if (!Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > 1000) throw bad("rank");
    if (titles.has(entry.article)) throw bad("duplicate_title");
    // Ranks are source metadata, not identities: tied counts may share a rank.
    titles.add(entry.article);
    return { title: entry.article, views: entry.views };
  });
}

/** Every requested title must resolve through explicit aliases, a sitelink, or a missing marker. */
export function parseTitleMappings(raw: unknown, titles: string[]): Map<string, string | null> {
  const bad = () => new MovieInterestSourceError("wikidata", "wikidata_incomplete_title_mapping");
  if (!object(raw) || raw.error || !object(raw.entities)) throw bad();
  const aliases = new Map<string, string>();
  for (const key of ["normalized", "redirects"]) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) throw bad();
    for (const row of raw[key] ?? []) {
      if (!object(row) || typeof row.from !== "string" || typeof row.to !== "string") throw bad();
      const from = normalizeArticleTitle(row.from), to = normalizeArticleTitle(row.to);
      if (!from || !to || (aliases.has(from) && aliases.get(from) !== to)) throw bad();
      if (from !== to) aliases.set(from, to);
    }
  }
  const canonical = (title: string) => {
    let current = normalizeArticleTitle(title);
    const seen = new Set<string>();
    while (aliases.has(current)) {
      if (seen.has(current) || seen.size > 20) throw bad();
      seen.add(current); current = aliases.get(current)!;
    }
    return current;
  };
  const requested = new Set(titles.map(canonical));
  const resolved = new Map<string, string | null>();
  for (const [key, entity] of Object.entries(raw.entities)) {
    if (!object(entity)) throw bad();
    let title: string, qid: string | null;
    if (entity.missing === "" || entity.missing === true) {
      if (entity.site !== "enwiki" || typeof entity.title !== "string") throw bad();
      title = canonical(entity.title); qid = null;
    } else {
      const link = entity.sitelinks?.enwiki;
      if (!/^Q[1-9]\d{0,22}$/.test(key) || entity.id !== key || !object(link) || link.site !== "enwiki" || typeof link.title !== "string") throw bad();
      title = canonical(link.title); qid = key;
    }
    if (!requested.has(title) || (resolved.has(title) && resolved.get(title) !== qid)) throw bad();
    resolved.set(title, qid);
  }
  const out = new Map<string, string | null>();
  for (const title of titles) {
    const name = canonical(title);
    if (!resolved.has(name)) throw bad();
    out.set(normalizeArticleTitle(title), resolved.get(name)!);
  }
  return out;
}
export function projectObservations(articles: InterestArticle[], mappings: Map<string, string | null>) {
  const byQid = new Map<string, number>();
  let mappedArticleCount = 0, missingArticleCount = 0, duplicateQidCount = 0;
  for (const article of articles) {
    const title = normalizeArticleTitle(article.title);
    if (!mappings.has(title)) throw new MovieInterestSourceError("wikidata", "wikidata_incomplete_title_mapping");
    const qid = mappings.get(title);
    if (qid === null) { missingArticleCount++; continue; }
    if (!qid) throw new MovieInterestSourceError("wikidata", "wikidata_incomplete_title_mapping");
    mappedArticleCount++;
    if (byQid.has(qid)) duplicateQidCount++;
    byQid.set(qid, Math.max(byQid.get(qid) ?? 0, article.views));
  }
  return { observations: [...byQid].map(([wikidataId, views]) => ({ wikidataId, views })), articleCount: articles.length, mappedArticleCount, missingArticleCount, duplicateQidCount };
}

export function titleMappingUrl(titles: string[]): URL {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({ action: "wbgetentities", sites: "enwiki", titles: titles.join("|"), props: "info|sitelinks", sitefilter: "enwiki", format: "json", maxlag: "5" }).toString();
  return url;
}
export function titleMappingBatches(titles: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  for (const title of titles) {
    if (titleMappingUrl([title]).href.length > 6500) throw new MovieInterestSourceError("wikidata", "wikidata_title_url_too_large");
    if (current.length && (current.length === 50 || titleMappingUrl([...current, title]).href.length > 6500)) { batches.push(current); current = []; }
    current.push(title);
  }
  if (current.length) batches.push(current);
  return batches;
}
export function assertCompleteProjection(projection: InterestProjection): void {
  if (!isSourceDay(projection.sourceDate) || projection.articleCount !== 1000 || !Number.isInteger(projection.mappedArticleCount) || !Number.isInteger(projection.missingArticleCount)
    || !Number.isInteger(projection.duplicateQidCount) || projection.mappedArticleCount < 0 || projection.missingArticleCount < 0 || projection.duplicateQidCount < 0
    || projection.mappedArticleCount + projection.missingArticleCount !== 1000 || projection.observations.length !== projection.mappedArticleCount - projection.duplicateQidCount) throw new Error("incomplete_movie_interest_projection");
  for (const observations of [projection.observations, projection.rollingObservations]) {
    if (!Array.isArray(observations)) throw new Error("invalid_movie_interest_observation");
    const ids = new Set<string>();
    for (const observation of observations) {
      if (!/^Q[1-9]\d{0,22}$/.test(observation.wikidataId) || ids.has(observation.wikidataId) || !Number.isSafeInteger(observation.views) || observation.views < 0 || observation.views > 2_147_483_647) throw new Error("invalid_movie_interest_observation");
      ids.add(observation.wikidataId);
    }
  }
  if (projection.rollingObservations.length > 64) throw new Error("invalid_movie_interest_observation");
}

export function interestWindowDays(day: string): string[] {
  if (!isSourceDay(day)) throw new Error("invalid_source_date");
  const end = Date.parse(day + "T00:00:00Z");
  return [2, 1, 0].map((offset) => new Date(end - offset * DAY).toISOString().slice(0, 10));
}
export function articleViewsUrl(article: string, day: string): URL {
  if (!isSourceDay(day) || !article.trim() || article.length > 512) throw new Error("invalid_article_observation");
  const days = interestWindowDays(day);
  const timestamp = (date: string) => date.replace(/-/g, "") + "00";
  return new URL(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(article.replace(/ /g, "_"))}/daily/${timestamp(days[0])}/${timestamp(day)}`);
}
/** Missing days are unobserved; every accepted film uses the same denominator. */
export function parseArticleViews(raw: unknown, article: string, day: string): number | null {
  const bad = () => new MovieInterestSourceError("aqs", "aqs_invalid_article_observation");
  if (!object(raw) || !Array.isArray(raw.items) || raw.items.length > 3) throw bad();
  const dates = interestWindowDays(day).map((date) => date.replace(/-/g, "") + "00");
  const observations = new Map<string, number>();
  for (const row of raw.items) {
    if (!object(row) || !["en.wikipedia", "en.wikipedia.org"].includes(row.project) || row.access !== "all-access" || row.agent !== "user"
      || row.granularity !== "daily" || !dates.includes(row.timestamp) || observations.has(row.timestamp)
      || typeof row.article !== "string" || normalizeArticleTitle(row.article) !== normalizeArticleTitle(article)
      || !Number.isSafeInteger(row.views) || row.views < 0 || row.views > 2_147_483_647) throw bad();
    observations.set(row.timestamp, row.views);
  }
  if (observations.size !== 3) return null;
  return Math.floor(dates.reduce((sum, date, index) => sum + observations.get(date)! * (index + 1), 0) / 6);
}
