import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { commonsCategoryName, commonsCategoryPosterResponse, posterCategoryEvidence, posterSubcategory } from "./commons-category-poster";

const film = "Nosferatu (1922 film)";
const file = (name: string, overrides: { categories?: string; mime?: string; width?: number; height?: number; license?: Record<string, unknown> } = {}) => ({
  ns: 6, title: `File:${name}`, imageinfo: [{ mime: overrides.mime ?? "image/jpeg", width: overrides.width ?? 800, height: overrides.height ?? 1200,
    thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${encodeURIComponent(name)}/500px-${encodeURIComponent(name)}`,
    descriptionurl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name.replace(/ /g, "_"))}`,
    extmetadata: { Artist: { value: "Albin Grau" }, LicenseShortName: { value: "Public domain" }, Copyrighted: { value: "False" },
      Categories: { value: overrides.categories ?? film }, ...overrides.license } }] });
const body = (...pages: unknown[]) => ({ batchcomplete: true, query: { pages } });

describe("Commons category name normalization", () => {
  it("accepts P373 names with optional prefix and rejects unsafe titles", () => {
    expect(commonsCategoryName("  Nosferatu_(1922 film) ")).toBe(film);
    expect(commonsCategoryName("Category:Star Wars: Episode IV")).toBe("Star Wars: Episode IV");
    for (const value of ["", "A|B", "A#b", "x\u0000", "[[A]]", 5, null, "x".repeat(241)]) expect(commonsCategoryName(value)).toBeNull();
  });
});

describe("Commons category poster evidence", () => {
  it("requires film-poster categories or a poster category named after the film", () => {
    for (const category of ["Film posters", "1920s film posters", "Film posters of Germany", "German movie posters", `${film} posters`, `Posters of ${film}`])
      expect(posterCategoryEvidence(category, film)).toBe(true);
    for (const category of ["Posters", film, "Photographs of film posters", "Film posters in museums", "Posters in Berlin", "Missing film posters"])
      expect(posterCategoryEvidence(category, film)).toBe(false);
  });
  it("recognizes only this film's poster subcategories", () => {
    expect(posterSubcategory(`Category:${film} posters`, film)).toBe(`${film} posters`);
    expect(posterSubcategory(`Category:${film}/Posters`, film)).toBe(`${film}/Posters`);
    expect(posterSubcategory("Category:Film posters", film)).toBeNull();
    expect(posterSubcategory(`Category:Screenshots of ${film}`, film)).toBeNull();
    expect(posterSubcategory(`Category:Photographs of ${film} posters`, film)).toBeNull();
  });
});

describe("Commons category poster selection", () => {
  it("selects a freely licensed portrait file in a poster category and attributes Commons", () => {
    const result = commonsCategoryPosterResponse(body(file("Nosferatu poster.jpg", { categories: `${film}|1920s film posters` }), file("Nosferatu still.jpg")), film, false);
    expect(result.posterSubcategory).toBeNull();
    expect(result.poster).toMatchObject({ origin: "commons-category", fileName: "Nosferatu poster.jpg",
      attribution: { provider: "commons", rightsKind: "reusable", artist: "Albin Grau", license: "Public domain",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Nosferatu_poster.jpg" } });
  });
  it("prefers category evidence over filename-only evidence", () => {
    const result = commonsCategoryPosterResponse(body(file("A poster.jpg"), file("Z plakat.jpg", { categories: "Film posters" })), film, false);
    expect(result.poster?.fileName).toBe("Z plakat.jpg");
    expect(commonsCategoryPosterResponse(body(file("A poster.jpg")), film, false).poster?.fileName).toBe("A poster.jpg");
  });
  it("rejects stills, landscape images, logos, photos of posters and files without poster evidence", () => {
    const rejected = [
      file("Max Schreck.jpg"),
      file("Nosferatu screenshot poster.jpg", { categories: "Film posters" }),
      file("Nosferatu poster.jpg", { width: 1600, height: 900 }),
      file("Nosferatu poster.svg", { mime: "image/svg+xml" }),
      file("Nosferatu poster.jpg", { categories: "Photographs of film posters" }),
      file("Tiny poster.jpg", { width: 100, height: 150 }),
    ];
    for (const page of rejected) expect(commonsCategoryPosterResponse(body(page), film, false).poster).toBeNull();
  });
  it("never accepts non-free or incompletely licensed files", () => {
    const nonFree = file("Nosferatu poster.jpg", { categories: "Film posters", license: { NonFree: { value: "true" } } });
    const fairUse = file("Nosferatu poster.jpg", { categories: "Film posters", license: { LicenseShortName: { value: "Fair use" } } });
    const noArtist = file("Nosferatu poster.jpg", { categories: "Film posters", license: { Artist: { value: "" } } });
    for (const page of [nonFree, fairUse, noArtist]) expect(commonsCategoryPosterResponse(body(page), film, false).poster).toBeNull();
  });
  it("trusts poster-subcategory membership but still checks shape and license", () => {
    expect(commonsCategoryPosterResponse(body(file("Nosferatu 1922.jpg")), film, true).poster?.fileName).toBe("Nosferatu 1922.jpg");
    expect(commonsCategoryPosterResponse(body(file("Nosferatu 1922.jpg", { width: 1600, height: 900 })), film, true).poster).toBeNull();
  });
  it("reports a poster subcategory only from the film category listing", () => {
    const listing = body({ ns: 14, title: `Category:${film} posters` }, { ns: 14, title: "Category:Max Schreck" }, file("Max Schreck.jpg"));
    expect(commonsCategoryPosterResponse(listing, film, false)).toEqual({ poster: null, posterSubcategory: `${film} posters` });
    expect(commonsCategoryPosterResponse(listing, film, true).posterSubcategory).toBeNull();
  });
  it("treats a missing category as empty and rejects malformed responses", () => {
    expect(commonsCategoryPosterResponse({ batchcomplete: true }, film, false)).toEqual({ poster: null, posterSubcategory: null });
    expect(commonsCategoryPosterResponse({ ...body(file("Max Schreck.jpg")), continue: { gcmcontinue: "file|x", continue: "gcmcontinue||" } }, film, false).poster).toBeNull();
    for (const value of [null, { error: { code: "x" } }, { warnings: {}, query: { pages: [] } }, { query: { pages: {} } }, { continue: { clcontinue: "x" }, query: { pages: [] } }])
      expect(() => commonsCategoryPosterResponse(value, film, false)).toThrow("commons_invalid_response");
  });
});
