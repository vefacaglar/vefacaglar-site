import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { normalizeWikipediaPoster, wikipediaArticleTitle, wikipediaPosterReferences, wikipediaPostersResponse } from "./wikipedia-poster";

const info = () => ({ mime: "image/jpeg", thumburl: "https://upload.wikimedia.org/wikipedia/en/1/1c/Godfather_ver1.jpg",
  descriptionurl: "https://en.wikipedia.org/wiki/File:Godfather_ver1.jpg",
  extmetadata: { Categories: { value: "All non-free media|1970s American film posters" }, NonFree: { value: "true" },
    Copyrighted: { value: "True" }, LicenseShortName: { value: "Fair use" } } });
const candidate = { wikidataId: "Q47703", article: "The Godfather", title: "The Godfather" };

describe("Wikipedia poster source validation", () => {
  it("accepts genuine poster metadata with explicit non-free rights and no invented creator", () => {
    expect(normalizeWikipediaPoster(info())).toMatchObject({ attribution: { provider: "wikipedia", rightsKind: "non-free",
      artist: null, license: "Fair use", licenseUrl: null } });
    for (const category of ["2020s American film posters", "Film posters for English-language films", "Dune (franchise) film posters"]) {
      const row = info(); row.extmetadata.Categories.value = category;
      expect(normalizeWikipediaPoster(row)).not.toBeNull();
    }
  });
  it("rejects stills/logos even when a filename looks like a poster", () => {
    const row = info(); row.extmetadata.Categories.value = "Film screenshots|Studio logos";
    expect(normalizeWikipediaPoster(row)).toBeNull();
    expect(normalizeWikipediaPoster({ ...info(), extmetadata: {} })).toBeNull();
  });
  it("rejects unknown rights and untrusted media/source URLs", () => {
    const row = info(); row.extmetadata.NonFree.value = "false";
    expect(normalizeWikipediaPoster(row)).toBeNull();
    expect(normalizeWikipediaPoster({ ...info(), thumburl: "https://upload.wikimedia.org.evil.example/wikipedia/en/a.jpg" })).toBeNull();
    expect(normalizeWikipediaPoster({ ...info(), descriptionurl: "https://example.com/wiki/File:Poster.jpg" })).toBeNull();
  });
  it("requires the exact article QID after redirects and normalizations", () => {
    const body = { query: { normalized: [{ from: "The_Godfather_(film)", to: "The Godfather (film)" }],
      redirects: [{ from: "The Godfather (film)", to: "The Godfather" }],
      pages: [{ ns: 0, title: "The Godfather", pageimage: "Godfather_ver1.jpg", pageprops: { wikibase_item: "Q47703" } }] } };
    expect(wikipediaPosterReferences(body, [{ ...candidate, article: "The_Godfather_(film)" }]).Q47703?.fileName).toBe("Godfather ver1.jpg");
    expect(wikipediaPosterReferences(body, [{ ...candidate, wikidataId: "Q163872" }]).Q163872).toBeNull();
  });
  it("handles source article absence, while incomplete responses remain retryable", () => {
    expect(wikipediaPosterReferences({ query: { pages: [{ title: "The Godfather", ns: 0, missing: true }] } }, [candidate])).toEqual({ Q47703: null });
    expect(() => wikipediaPosterReferences({ query: { pages: [] } }, [candidate])).toThrow("wikipedia_missing_article_response");
    expect(wikipediaArticleTitle("Dune:_Part_Two")).toBe("Dune: Part Two");
    expect(wikipediaArticleTitle("File:Poster.jpg")).toBeNull();
  });
  it("matches normalized file titles and marks the resolved source for compare-and-swap writes", () => {
    const reference = { ...candidate, fileName: "Godfather_ver1.jpg" };
    const body = { query: { normalized: [{ from: "File:Godfather_ver1.jpg", to: "File:Godfather ver1.jpg" }],
      pages: [{ ns: 6, title: "File:Godfather ver1.jpg", imageinfo: [info()] }] } };
    expect(wikipediaPostersResponse(body, [reference]).Q47703).toMatchObject({ origin: "wikipedia", fileName: "Godfather_ver1.jpg" });
    expect(() => wikipediaPostersResponse({ query: { pages: [] } }, [reference])).toThrow("wikipedia_missing_file_response");
  });
  it("withholds explicit sequel conflicts after validating the QID and canonical redirect title", () => {
    const body = { query: { redirects: [{ from: "Jailer sequel", to: "Jailer 2" }],
      pages: [{ ns: 0, title: "Jailer 2", pageimage: "Jailer_2_poster.jpg", pageprops: { wikibase_item: "Q133255153" } }] } };
    expect(wikipediaPosterReferences(body, [{ wikidataId: "Q133255153", article: "Jailer sequel", title: "Jailer 3" }])).toEqual({ Q133255153: null });
    expect(wikipediaPosterReferences(body, [{ wikidataId: "Q133255153", article: "Jailer sequel", title: "Jailer 2" }]).Q133255153).not.toBeNull();
  });
});
