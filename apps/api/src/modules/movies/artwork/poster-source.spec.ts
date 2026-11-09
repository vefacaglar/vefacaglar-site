import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { posterInputsPatch, publicMoviePoster } from "./poster-source";

const now = new Date("2026-11-07T10:00:00Z");
const stored = () => ({ title: "The Godfather", posterFileName: null, enwikiArticle: "The Godfather", commonsCategory: null as string | null, posterInputsCheckedAt: now,
  posterCandidateVersion: 7, posterResolvedFrom: "wikipedia", posterAttribution: null });
describe("public poster rights guard", () => {
  const base = { title: "Inception", enwikiArticle: "Inception", posterResolvedFrom: "wikipedia", posterImageUrl: "https://upload.wikimedia.org/p.jpg", posterBlockedAt: null };
  const attribution = { sourceUrl: "https://en.wikipedia.org/wiki/File:P.jpg", artist: null, license: "x", licenseUrl: null };
  it("hides stored non-free posters", () => {
    expect(publicMoviePoster({ ...base, posterAttribution: { ...attribution, provider: "wikipedia", rightsKind: "non-free" } }))
      .toEqual({ posterImageUrl: null, posterAttribution: null });
  });
  it("keeps reusable and legacy attribution-less-rights posters", () => {
    expect(publicMoviePoster({ ...base, posterAttribution: { ...attribution, rightsKind: "reusable" } }).posterImageUrl).toBe(base.posterImageUrl);
    expect(publicMoviePoster({ ...base, posterAttribution: attribution }).posterImageUrl).toBe(base.posterImageUrl);
  });
  it("hides an admin-blocked reusable poster together with its credit", () => {
    const reusable = { ...base, posterResolvedFrom: "commons", posterAttribution: { ...attribution, rightsKind: "reusable" as const } };
    expect(publicMoviePoster({ ...reusable, posterBlockedAt: new Date("2026-11-01T00:00:00Z") })).toEqual({ posterImageUrl: null, posterAttribution: null });
    // Raw JSON reads carry the timestamp as a string.
    expect(publicMoviePoster({ ...reusable, posterBlockedAt: "2026-11-01T00:00:00+00:00" })).toEqual({ posterImageUrl: null, posterAttribution: null });
  });
});

describe("source-aware poster invalidation", () => {
  it("keeps valid Wikipedia artwork when P3383 remains absent", () => {
    const patch = posterInputsPatch(stored(), { title: "The Godfather", posterFileName: null, enwikiArticle: "The Godfather", commonsCategory: null }, now);
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch).not.toHaveProperty("posterCandidateVersion");
  });
  it("invalidates the old article image and advances the CAS version when the sitelink changes", () => {
    expect(posterInputsPatch(stored(), { title: "The Godfather", posterFileName: null, enwikiArticle: "Different film", commonsCategory: null }, now))
      .toMatchObject({ posterImageUrl: null, posterAttribution: null, posterCandidateVersion: 8, posterCheckedAt: null });
  });
  it("preserves article artwork while a new preferred Commons candidate is being resolved", () => {
    const patch = posterInputsPatch(stored(), { title: "The Godfather", posterFileName: "Free poster.jpg", enwikiArticle: "The Godfather", commonsCategory: null }, now);
    expect(patch).toMatchObject({ posterCandidateVersion: 8, posterRetryAfter: null });
    expect(patch).not.toHaveProperty("posterImageUrl");
  });
  it("keeps legacy Commons art when only the new sitelink is populated", () => {
    const existing = { ...stored(), posterFileName: "Poster.jpg", enwikiArticle: null, posterInputsCheckedAt: null, posterResolvedFrom: null };
    const patch = posterInputsPatch(existing, { title: "The Godfather", posterFileName: "Poster.jpg", enwikiArticle: "The Godfather", commonsCategory: null }, now);
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch.posterCandidateVersion).toBe(8);
  });
  it("durably records genuinely missing sources instead of repeating bootstrap every window", () => {
    expect(posterInputsPatch({ ...stored(), posterInputsCheckedAt: null }, { title: "The Godfather", posterFileName: null, enwikiArticle: null, commonsCategory: null }, now))
      .toMatchObject({ posterInputsCheckedAt: now, posterErrorCode: "poster_sources_missing", posterRetryAfter: new Date("2026-12-07T10:00:00Z") });
  });
  it("includes title changes in the candidate version and invalidates contradictory Wikipedia artwork", () => {
    const existing = { ...stored(), title: "Jailer 2", enwikiArticle: "Jailer 2" };
    expect(posterInputsPatch(existing, { title: "Jailer 3", posterFileName: null, enwikiArticle: "Jailer 2", commonsCategory: null }, now))
      .toMatchObject({ posterCandidateVersion: 8, posterImageUrl: null, posterAttribution: null, posterRetryAfter: null });
  });
  it("uses the unchanged snapshot's persisted title without repeatedly bumping its artwork version", () => {
    const existing = { ...stored(), title: "Jailer 2", enwikiArticle: "Jailer 2" };
    const patch = posterInputsPatch(existing, { title: "Jailer 3", posterFileName: null, enwikiArticle: "Jailer 2", commonsCategory: null }, now, { preserveStoredTitle: true });
    expect(patch).not.toHaveProperty("posterCandidateVersion");
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch).not.toHaveProperty("title");
  });
  it("re-queues artwork when a Commons category first appears without discarding other artwork", () => {
    const patch = posterInputsPatch(stored(), { title: "The Godfather", posterFileName: null, enwikiArticle: "The Godfather", commonsCategory: "The Godfather" }, now);
    expect(patch).toMatchObject({ commonsCategory: "The Godfather", posterCandidateVersion: 8, posterCheckedAt: null, posterRetryAfter: null });
    expect(patch).not.toHaveProperty("posterImageUrl");
  });
  it("invalidates category artwork only when the category changes", () => {
    const existing = { ...stored(), enwikiArticle: null, commonsCategory: "Nosferatu", posterResolvedFrom: "commons-category" };
    expect(posterInputsPatch(existing, { title: "The Godfather", posterFileName: null, enwikiArticle: "Other", commonsCategory: "Nosferatu" }, now))
      .not.toHaveProperty("posterImageUrl");
    expect(posterInputsPatch(existing, { title: "The Godfather", posterFileName: null, enwikiArticle: null, commonsCategory: "Nosferatu (1922 film)" }, now))
      .toMatchObject({ posterImageUrl: null, posterResolvedFrom: null, posterCandidateVersion: 8 });
  });
  it("treats a category as a poster source when no file or article exists", () => {
    expect(posterInputsPatch({ ...stored(), posterInputsCheckedAt: null }, { title: "The Godfather", posterFileName: null, enwikiArticle: null, commonsCategory: "The Godfather" }, now))
      .toMatchObject({ posterCheckedAt: null, posterErrorCode: null });
  });
  it("suppresses both cached Wikipedia image and credit, including Commons-hosted article artwork", () => {
    const attribution = { provider: "commons" as const, sourceUrl: "https://commons.wikimedia.org/wiki/File:Poster.jpg", artist: "Studio", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
    const movie = { title: "Jailer 3", enwikiArticle: "Jailer 2", posterResolvedFrom: "wikipedia", posterImageUrl: "https://upload.wikimedia.org/wikipedia/commons/Poster.jpg", posterAttribution: attribution, posterBlockedAt: null };
    expect(publicMoviePoster(movie)).toEqual({ posterImageUrl: null, posterAttribution: null });
    expect(publicMoviePoster({ ...movie, posterResolvedFrom: "commons" })).toEqual({ posterImageUrl: movie.posterImageUrl, posterAttribution: attribution });
    expect(publicMoviePoster({ ...movie, enwikiArticle: "Jailer 3", posterAttribution: { ...attribution, articleTitle: "Jailer 2" } }))
      .toEqual({ posterImageUrl: null, posterAttribution: null });
  });
});
