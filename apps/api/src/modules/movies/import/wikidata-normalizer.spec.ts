import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { addCharacterLabels, characterQidsFromQualifiers, isImdbId, movieSlug, movieSnapshotDisposition, normalizeMovie, wikipediaLanguageCount } from "./wikidata-normalizer";
const statement = (property: string, value: unknown, id = property) => ({ id: `Q47703$${id}`, rank: "normal", mainsnak: { property, snaktype: "value", datavalue: { value } } });
const movie = (extra: Record<string, unknown> = {}) => ({ id: "Q47703", type: "item", labels: { en: { value: "The Godfather" } },
  lastrevid: 123, modified: "2026-11-05T00:00:00Z", sitelinks: {}, claims: { P31: [statement("P31", { id: "Q11424" })], ...extra } });
describe("Wikidata movie normalization", () => {
  it("requires a complete matching item and verified classification", () => {
    expect(() => normalizeMovie({ id: "Q47703", type: "item", labels: {} }, "Q47703")).toThrow();
    expect(() => normalizeMovie({ ...movie(), missing: "" }, "Q47703")).toThrow();
    expect(() => normalizeMovie(movie(), "Q9")).toThrow();
    expect(normalizeMovie(movie({ P31: [statement("P31", { id: "Q5" })] }), "Q47703").isFilm).toBe(false);
    expect(() => normalizeMovie(movie({ P272: [statement("P272", {})] }), "Q47703")).toThrow();
  });
  it("retains original titles and source revision without inventing names", () => {
    const raw = movie({ P1476: [statement("P1476", { text: "Il padrino", language: "it" })] });
    raw.labels = {} as any;
    const result = normalizeMovie(raw, "Q47703");
    expect(result.title).toBe("Il padrino");
    expect(result.sourceRevision).toBe(123);
    expect(result.sourceModifiedAt?.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(movieSlug(result.title, "Q47703")).toBe("il-padrino-q47703");
  });
  it("preserves date precision and accepts only explicitly minute runtimes", () => {
    const result = normalizeMovie(movie({ P577: [statement("P577", { time: "+1972-00-00T00:00:00Z", precision: 9, calendarmodel: "http://www.wikidata.org/entity/Q1985727" })],
      P2047: [statement("P2047", { amount: "+175", unit: "http://www.wikidata.org/entity/Q7727" })] }), "Q47703");
    expect([result.releaseYear, result.releaseDate, result.releasePrecision, result.runtimeMinutes]).toEqual([1972, null, 9, 175]);
    expect(normalizeMovie(movie({ P2047: [statement("P2047", { amount: "+175", unit: "1" })] }), "Q47703").runtimeMinutes).toBeNull();
  });
  it("keeps multiple source roles and qualifiers without inventing cast order", () => {
    const cast = { ...statement("P161", { id: "Q123" }), qualifiers: { P4633: [{ snaktype: "value", datavalue: { value: "Vito" } }], P453: [{ snaktype: "value", datavalue: { value: { id: "Q456" } } }] } };
    const result = addCharacterLabels(normalizeMovie(movie({ P161: [cast], P57: [statement("P57", { id: "Q123" })] }), "Q47703"), { Q456: "Vito Corleone" });
    expect(result.credits).toHaveLength(2);
    expect(result.credits.map((c) => c.roleProperty)).toEqual(["P161", "P57"]);
    expect(result.credits[0].characterNames).toEqual(["Vito", "Vito Corleone"]);
    expect(result.credits[0].qualifiers).toEqual(cast.qualifiers);
  });
  it("rejects conflicting GUIDs and keeps ambiguous IMDb IDs unknown", () => {
    expect(() => normalizeMovie(movie({ P161: [statement("P161", { id: "Q1" }, "same"), statement("P161", { id: "Q2" }, "same")] }), "Q47703")).toThrow();
    const result = normalizeMovie(movie({ P345: [statement("P345", "tt0068646", "a"), statement("P345", "tt0111161", "b")] }), "Q47703");
    expect(result.imdbId).toBeNull(); expect(result.imdbConflict).toBe(true);
    expect(isImdbId("https://imdb.com/tt0068646")).toBe(false);
  });
  it("rejects incomplete info but accepts an explicit complete classification removal", () => {
    for (const key of ["lastrevid", "modified"]) {
      const raw = movie() as Record<string, unknown>;
      delete raw[key];
      expect(() => normalizeMovie(raw, "Q47703")).toThrow("incomplete_entity_info");
    }
    expect(normalizeMovie({ ...movie(), claims: {} }, "Q47703").isFilm).toBe(false);
  });
  it("preserves monotonic snapshots and retries IMDb ownership conflicts at the same revision", () => {
    expect(() => movieSnapshotDisposition(null, 42, true, false)).toThrow("incomplete_entity_info");
    expect(() => movieSnapshotDisposition(41, 42, true, false)).toThrow("stale_source_revision");
    expect(movieSnapshotDisposition(42, 42, true, false)).toBe("unchanged");
    expect(movieSnapshotDisposition(42, 42, true, true)).toBe("replace");
    expect(movieSnapshotDisposition(43, 42, true, false)).toBe("replace");
  });
  it("retains only explicit character references for later cached-label resolution", () => {
    const reference = { snaktype: "value", datavalue: { value: { id: "Q456" } } };
    expect(characterQidsFromQualifiers({ P453: [reference, reference, { snaktype: "somevalue" }, { ...reference, datavalue: { value: { id: "invalid" } } }] })).toEqual(["Q456"]);
    expect(characterQidsFromQualifiers({})).toEqual([]);
  });

  it("matches the truthy classification used by direct-film discovery", () => {
    const preferred = { ...statement("P31", { id: "Q5" }, "preferred-class"), rank: "preferred" };
    expect(normalizeMovie(movie({ P31: [statement("P31", { id: "Q11424" }), preferred] }), "Q47703").isFilm).toBe(false);
  });

  it("only extracts explicit active poster claims and can enrich unchanged revisions", () => {
    expect(normalizeMovie(movie({ P18: [statement("P18", "Still.jpg")] }), "Q47703").posterFileName).toBeNull();
    expect(normalizeMovie(movie({ P3383: [statement("P3383", "Film_poster.jpg")] }), "Q47703").posterFileName).toBe("Film poster.jpg");
    expect(normalizeMovie(movie({ P3383: [{ ...statement("P3383", "Old.jpg"), rank: "deprecated" }] }), "Q47703").posterFileName).toBeNull();
    const poster = { ...statement("P3383", "Preferred.jpg", "preferred-poster"), rank: "preferred" };
    expect(normalizeMovie(movie({ P3383: [statement("P3383", "Other.jpg"), poster] }), "Q47703").posterFileName).toBe("Preferred.jpg");
    expect(movieSnapshotDisposition(123, 123, true, false)).toBe("unchanged");
  });
  it("requires complete sitelinks and retains only the exact enwiki article title", () => {
    expect(normalizeMovie({ ...movie(), sitelinks: { enwiki: { site: "enwiki", title: "The Godfather", url: "https://en.wikipedia.org/wiki/The_Godfather" } } }, "Q47703").enwikiArticle).toBe("The Godfather");
    expect(normalizeMovie(movie(), "Q47703").enwikiArticle).toBeNull();
    const raw = movie() as Record<string, unknown>; delete raw.sitelinks;
    expect(() => normalizeMovie(raw, "Q47703")).toThrow("incomplete_entity_sitelinks");
    expect(() => normalizeMovie({ ...movie(), sitelinks: { enwiki: { site: "enwiki", title: "File:Poster.jpg" } } }, "Q47703")).toThrow("invalid_entity_sitelink");
  });

  it("counts distinct Wikipedia editions, excluding sibling projects and duplicate mobile hosts", () => {
    const link = (site: string, url: string) => ({ site, title: "A film", url });
    expect(wikipediaLanguageCount({
      enwiki: link("enwiki", "https://en.wikipedia.org/wiki/A_film"),
      mobile: link("mobile", "https://en.m.wikipedia.org/wiki/A_film"),
      dewiki: link("dewiki", "https://de.wikipedia.org/wiki/A_film"),
      commonswiki: link("commonswiki", "https://commons.wikimedia.org/wiki/Category:A_film"),
      specieswiki: link("specieswiki", "https://species.wikimedia.org/wiki/A_film"),
      enwikiquote: link("enwikiquote", "https://en.wikiquote.org/wiki/A_film"),
    })).toBe(2);
    expect(normalizeMovie(movie(), "Q47703").wikipediaLanguageCount).toBe(0);
    expect(() => wikipediaLanguageCount({ enwiki: { site: "enwiki", title: "Film" } })).toThrow("invalid_entity_sitelink");
    expect(() => wikipediaLanguageCount({ enwiki: link("other", "https://en.wikipedia.org/wiki/Film") })).toThrow("invalid_entity_sitelink");
  });

});
