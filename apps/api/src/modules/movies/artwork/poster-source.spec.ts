import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { posterInputsPatch, publicMoviePoster } from "./poster-source";

const now = new Date("2026-11-07T10:00:00Z");
const stored = () => ({ title: "The Godfather", posterFileName: null, enwikiArticle: "The Godfather", posterInputsCheckedAt: now,
  posterCandidateVersion: 7, posterResolvedFrom: "wikipedia", posterAttribution: null });
describe("source-aware poster invalidation", () => {
  it("keeps valid Wikipedia artwork when P3383 remains absent", () => {
    const patch = posterInputsPatch(stored(), { title: "The Godfather", posterFileName: null, enwikiArticle: "The Godfather" }, now);
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch).not.toHaveProperty("posterCandidateVersion");
  });
  it("invalidates the old article image and advances the CAS version when the sitelink changes", () => {
    expect(posterInputsPatch(stored(), { title: "The Godfather", posterFileName: null, enwikiArticle: "Different film" }, now))
      .toMatchObject({ posterImageUrl: null, posterAttribution: null, posterCandidateVersion: 8, posterCheckedAt: null });
  });
  it("preserves article artwork while a new preferred Commons candidate is being resolved", () => {
    const patch = posterInputsPatch(stored(), { title: "The Godfather", posterFileName: "Free poster.jpg", enwikiArticle: "The Godfather" }, now);
    expect(patch).toMatchObject({ posterCandidateVersion: 8, posterRetryAfter: null });
    expect(patch).not.toHaveProperty("posterImageUrl");
  });
  it("keeps legacy Commons art when only the new sitelink is populated", () => {
    const existing = { ...stored(), posterFileName: "Poster.jpg", enwikiArticle: null, posterInputsCheckedAt: null, posterResolvedFrom: null };
    const patch = posterInputsPatch(existing, { title: "The Godfather", posterFileName: "Poster.jpg", enwikiArticle: "The Godfather" }, now);
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch.posterCandidateVersion).toBe(8);
  });
  it("durably records genuinely missing sources instead of repeating bootstrap every window", () => {
    expect(posterInputsPatch({ ...stored(), posterInputsCheckedAt: null }, { title: "The Godfather", posterFileName: null, enwikiArticle: null }, now))
      .toMatchObject({ posterInputsCheckedAt: now, posterErrorCode: "poster_sources_missing", posterRetryAfter: new Date("2026-12-07T10:00:00Z") });
  });
  it("includes title changes in the candidate version and invalidates contradictory Wikipedia artwork", () => {
    const existing = { ...stored(), title: "Jailer 2", enwikiArticle: "Jailer 2" };
    expect(posterInputsPatch(existing, { title: "Jailer 3", posterFileName: null, enwikiArticle: "Jailer 2" }, now))
      .toMatchObject({ posterCandidateVersion: 8, posterImageUrl: null, posterAttribution: null, posterRetryAfter: null });
  });
  it("uses the unchanged snapshot's persisted title without repeatedly bumping its artwork version", () => {
    const existing = { ...stored(), title: "Jailer 2", enwikiArticle: "Jailer 2" };
    const patch = posterInputsPatch(existing, { title: "Jailer 3", posterFileName: null, enwikiArticle: "Jailer 2" }, now, { preserveStoredTitle: true });
    expect(patch).not.toHaveProperty("posterCandidateVersion");
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch).not.toHaveProperty("title");
  });
  it("suppresses both cached Wikipedia image and credit, including Commons-hosted article artwork", () => {
    const attribution = { provider: "commons" as const, sourceUrl: "https://commons.wikimedia.org/wiki/File:Poster.jpg", artist: "Studio", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
    const movie = { title: "Jailer 3", enwikiArticle: "Jailer 2", posterResolvedFrom: "wikipedia", posterImageUrl: "https://upload.wikimedia.org/wikipedia/commons/Poster.jpg", posterAttribution: attribution };
    expect(publicMoviePoster(movie)).toEqual({ posterImageUrl: null, posterAttribution: null });
    expect(publicMoviePoster({ ...movie, posterResolvedFrom: "commons" })).toEqual({ posterImageUrl: movie.posterImageUrl, posterAttribution: attribution });
    expect(publicMoviePoster({ ...movie, enwikiArticle: "Jailer 3", posterAttribution: { ...attribution, articleTitle: "Jailer 2" } }))
      .toEqual({ posterImageUrl: null, posterAttribution: null });
  });
});
