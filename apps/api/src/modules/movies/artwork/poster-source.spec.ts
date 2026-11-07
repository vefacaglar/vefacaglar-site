import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { posterInputsPatch } from "./poster-source";

const now = new Date("2026-11-07T10:00:00Z");
const stored = () => ({ posterFileName: null, enwikiArticle: "The Godfather", posterInputsCheckedAt: now,
  posterCandidateVersion: 7, posterResolvedFrom: "wikipedia", posterAttribution: null });
describe("source-aware poster invalidation", () => {
  it("keeps valid Wikipedia artwork when P3383 remains absent", () => {
    const patch = posterInputsPatch(stored(), { posterFileName: null, enwikiArticle: "The Godfather" }, now);
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch).not.toHaveProperty("posterCandidateVersion");
  });
  it("invalidates the old article image and advances the CAS version when the sitelink changes", () => {
    expect(posterInputsPatch(stored(), { posterFileName: null, enwikiArticle: "Different film" }, now))
      .toMatchObject({ posterImageUrl: null, posterAttribution: null, posterCandidateVersion: 8, posterCheckedAt: null });
  });
  it("preserves article artwork while a new preferred Commons candidate is being resolved", () => {
    const patch = posterInputsPatch(stored(), { posterFileName: "Free poster.jpg", enwikiArticle: "The Godfather" }, now);
    expect(patch).toMatchObject({ posterCandidateVersion: 8, posterRetryAfter: null });
    expect(patch).not.toHaveProperty("posterImageUrl");
  });
  it("keeps legacy Commons art when only the new sitelink is populated", () => {
    const existing = { ...stored(), posterFileName: "Poster.jpg", enwikiArticle: null, posterInputsCheckedAt: null, posterResolvedFrom: null };
    const patch = posterInputsPatch(existing, { posterFileName: "Poster.jpg", enwikiArticle: "The Godfather" }, now);
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch.posterCandidateVersion).toBe(8);
  });
  it("durably records genuinely missing sources instead of repeating bootstrap every window", () => {
    expect(posterInputsPatch({ ...stored(), posterInputsCheckedAt: null }, { posterFileName: null, enwikiArticle: null }, now))
      .toMatchObject({ posterInputsCheckedAt: now, posterErrorCode: "poster_sources_missing", posterRetryAfter: new Date("2026-12-07T10:00:00Z") });
  });
});
