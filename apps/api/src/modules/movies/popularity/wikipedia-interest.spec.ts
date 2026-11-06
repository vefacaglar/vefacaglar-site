import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { assertCompleteProjection, candidateSourceDays, movieRanking, normalizeArticleTitle, parseTitleMappings, parseTopArticles, projectObservations, snapshotDisposition, sourceIsFresh, titleMappingBatches, titleMappingUrl } from "./wikipedia-interest";
const now = new Date("2026-11-06T01:30:00Z");
const top = () => ({ items: [{ project: "en.wikipedia", access: "all-access", year: "2026", month: "11", day: "04", articles: Array.from({ length: 1000 }, (_, index) => ({ article: `Article_${index}`, views: 100000 - index, rank: index + 1 })) }] });
const resolved = (id: string, title: string) => ({ id, type: "item", sitelinks: { enwiki: { site: "enwiki", title } } });
describe("complete Wikipedia top-article projection", () => {
  it("accepts the real canonical en.wikipedia metadata and exactly1000 articles", () => {
    expect(parseTopArticles(top(), "2026-11-04")).toHaveLength(1000);
    expect(parseTopArticles(top(), "2026-11-04")[0]).toEqual({ title: "Article_0", views: 100000 });
  });
  it("does not confuse source rank ties with duplicate article identities", () => {
    const raw = top(); raw.items[0].day = "03";
    // Actual 2026-11-03 excerpt: two distinct articles shared rank147/views23290.
    raw.items[0].articles[146].rank = 147; raw.items[0].articles[146].views = 23290;
    raw.items[0].articles[147].rank = 147; raw.items[0].articles[147].views = 23290;
    expect(parseTopArticles(raw, "2026-11-03")).toHaveLength(1000);
  });
  it.each(["partial", "duplicate", "rank", "views", "project", "date"])("rejects an invalid complete source: %s", (kind) => {
    const raw = top();
    if (kind === "partial") raw.items[0].articles.pop();
    if (kind === "duplicate") raw.items[0].articles[1].article = "Article_0";
    if (kind === "rank") raw.items[0].articles[1].rank = 0;
    if (kind === "views") raw.items[0].articles[1].views = -1;
    if (kind === "project") raw.items[0].project = "de.wikipedia";
    if (kind === "date") raw.items[0].day = "05";
    expect(() => parseTopArticles(raw, "2026-11-04")).toThrow("aqs_invalid_complete_projection");
  });
  it("accounts for explicit missing entries and normalizes underscores without guessing QIDs", () => {
    const mapped = parseTitleMappings({ entities: { Q47703: resolved("Q47703", "The Godfather"), "-1": { site: "enwiki", title: "Special:Search", missing: "" }, Q76: resolved("Q76", "Barack Obama") } }, ["The_Godfather", "Special:Search", "Barack_Obama"]);
    expect([...mapped]).toEqual([["The Godfather", "Q47703"], ["Special:Search", null], ["Barack Obama", "Q76"]]);
  });
  it("follows explicit MediaWiki aliases and rejects unexplained omissions or alias cycles", () => {
    expect(parseTitleMappings({ redirects: [{ from: "Alias", to: "Canonical" }], entities: { Q1: resolved("Q1", "Canonical") } }, ["Alias"]).get("Alias")).toBe("Q1");
    expect(() => parseTitleMappings({ entities: { Q1: resolved("Q1", "Canonical") } }, ["Unexplained"])).toThrow();
    expect(() => parseTitleMappings({ redirects: [{ from: "A", to: "B" }, { from: "B", to: "A" }], entities: {} }, ["A"])).toThrow();
    expect(() => parseTitleMappings({ entities: {} }, ["Absent"])).toThrow();
    expect(() => parseTitleMappings({ entities: { "-1": { title: "Absent", missing: "" } } }, ["Absent"])).toThrow();
  });
  it("deduplicates QIDs using max views rather than summing aliases", () => {
    const projection = projectObservations([{ title: "A", views: 10 }, { title: "Alias", views: 30 }, { title: "Missing", views: 100 }], new Map([["A", "Q1"], ["Alias", "Q1"], ["Missing", null]]));
    expect(projection).toEqual({ observations: [{ wikidataId: "Q1", views: 30 }], articleCount: 3, mappedArticleCount: 2, missingArticleCount: 1, duplicateQidCount: 1 });
  });
  it("rejects unaccounted titles while allowing a validated all-missing projection", () => {
    expect(() => projectObservations([{ title: "A", views: 1 }], new Map())).toThrow();
    expect(() => assertCompleteProjection({ sourceDate: "2026-11-04", observations: [], articleCount: 1000, mappedArticleCount: 0, missingArticleCount: 1000, duplicateQidCount: 0, requests: 21, durationMs: 1 })).not.toThrow();
    expect(() => assertCompleteProjection({ sourceDate: "2026-11-04", observations: [], articleCount: 999, mappedArticleCount: 0, missingArticleCount: 999, duplicateQidCount: 0, requests: 21, durationMs: 1 })).toThrow();
  });
  it("bounds encoded URLs and title counts without omitting a long title", () => {
    const titles = Array.from({ length: 100 }, (_, index) => `Article ${index} ${"界".repeat(200)}`);
    const batches = titleMappingBatches(titles);
    expect(batches.flat()).toEqual(titles);
    expect(batches.every((batch) => batch.length <= 50 && titleMappingUrl(batch).href.length <= 6500)).toBe(true);
    expect(() => titleMappingBatches(["界".repeat(10000)])).toThrow("wikidata_title_url_too_large");
    expect(normalizeArticleTitle("The_Godfather")).toBe("The Godfather");
  });
});
describe("source-date and sparse ranking policy", () => {
  it("tries only the latest completed UTC day and at most two older days above accepted", () => {
    expect(candidateSourceDays(null, now)).toEqual(["2026-11-05", "2026-11-04", "2026-11-03"]);
    expect(candidateSourceDays("2026-11-04", now)).toEqual(["2026-11-05"]);
    expect(candidateSourceDays("2026-11-05", now)).toEqual([]);
    expect(candidateSourceDays(null, new Date("2026-11-06T00:01:00+03:00"))[0]).toBe("2026-11-04");
  });
  it("is idempotent on replay and rejects rollback, future and current-day observations", () => {
    expect(snapshotDisposition("2026-11-04", "2026-11-04", now)).toBe("unchanged");
    expect(() => snapshotDisposition("2026-11-03", "2026-11-04", now)).toThrow("stale_popularity_projection");
    expect(() => snapshotDisposition("2026-11-06", null, now)).toThrow("invalid_observation_day");
    expect(() => snapshotDisposition("2026-11-07", null, now)).toThrow("invalid_observation_day");
  });
  it("measures freshness only from the observed UTC day, never a new attempt/publication time", () => {
    expect(sourceIsFresh("2026-10-30", now)).toBe(true);
    expect(sourceIsFresh("2026-10-29", now)).toBe(false);
    expect(sourceIsFresh("2026-11-06", now)).toBe(false);
    expect(movieRanking("2026-10-29", now)).toMatchObject({ mode: "alphabetical", sourceDate: "2026-10-29", isFresh: false });
    expect(movieRanking("2026-11-04", now)).toMatchObject({ mode: "wikipedia_interest", isFresh: true, sourceUrl: "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access/2026/11/04" });
  });
});
