import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { commonsCategoryName, commonsFileName, posterInputsPatch, publicMoviePoster, wikipediaArticleTitle } from "./poster-source";

const now = new Date("2026-11-07T10:00:00Z");
const stored = () => ({
  title: "The Godfather",
  posterFileName: null,
  enwikiArticle: "The Godfather",
  commonsCategory: null as string | null,
  posterInputsCheckedAt: now,
  posterCandidateVersion: 7,
  posterResolvedFrom: "wikipedia",
  posterAttribution: null,
});

describe("public poster suppression", () => {
  const base = {
    title: "Inception",
    enwikiArticle: "Inception",
    posterResolvedFrom: "commons",
    posterImageUrl: "https://upload.wikimedia.org/p.jpg",
    posterBlockedAt: null,
  };
  const attribution = {
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Poster.jpg",
    artist: "Studio",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  };

  it("always suppresses stored poster URLs and attributions regardless of license or block state", () => {
    expect(publicMoviePoster({ ...base, posterAttribution: { ...attribution, rightsKind: "reusable" } }))
      .toEqual({ posterImageUrl: null, posterAttribution: null });
    expect(publicMoviePoster({ ...base, posterAttribution: attribution }))
      .toEqual({ posterImageUrl: null, posterAttribution: null });
    expect(publicMoviePoster({ ...base, posterAttribution: { ...attribution, provider: "wikipedia", rightsKind: "non-free" } }))
      .toEqual({ posterImageUrl: null, posterAttribution: null });
    expect(publicMoviePoster({ ...base, posterAttribution: { ...attribution, rightsKind: "reusable" }, posterBlockedAt: new Date("2026-11-01T00:00:00Z") }))
      .toEqual({ posterImageUrl: null, posterAttribution: null });
  });
});

describe("source claim string normalizers", () => {
  it("validates Wikidata P3383 filenames, P373 categories, and enwiki sitelinks", () => {
    expect(commonsFileName("  Film_poster.JPG  ")).toBe("Film poster.JPG");
    for (const name of ["https://x/Poster.jpg", "File:Poster.jpg", "Poster.jpg|Other.jpg", "Poster.jpg#x", "Poster.html", "x\u0000.jpg"]) {
      expect(commonsFileName(name)).toBeNull();
    }
    expect(commonsCategoryName(" Category:The_Godfather ")).toBe("The Godfather");
    expect(commonsCategoryName("The|Godfather")).toBeNull();
    expect(wikipediaArticleTitle("The_Godfather_(film)")).toBe("The Godfather (film)");
    expect(wikipediaArticleTitle("File:Poster.jpg")).toBeNull();
  });
});

describe("source-aware poster input tracking", () => {
  it("preserves stored fields when inputs are unchanged", () => {
    const patch = posterInputsPatch(stored(), { title: "The Godfather", posterFileName: null, enwikiArticle: "The Godfather", commonsCategory: null }, now);
    expect(patch).not.toHaveProperty("posterImageUrl");
    expect(patch).not.toHaveProperty("posterCandidateVersion");
  });

  it("invalidates stored artwork when its resolving source input changes", () => {
    expect(posterInputsPatch(stored(), { title: "The Godfather", posterFileName: null, enwikiArticle: "Different film", commonsCategory: null }, now))
      .toMatchObject({ posterImageUrl: null, posterAttribution: null, posterCandidateVersion: 8, posterCheckedAt: null });
    const existing = { ...stored(), enwikiArticle: null, commonsCategory: "Nosferatu", posterResolvedFrom: "commons-category" };
    expect(posterInputsPatch(existing, { title: "The Godfather", posterFileName: null, enwikiArticle: null, commonsCategory: "Nosferatu (1922 film)" }, now))
      .toMatchObject({ posterImageUrl: null, posterResolvedFrom: null, posterCandidateVersion: 8 });
  });
});
