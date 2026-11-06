import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { attributionText, commonsFileName, commonsPostersResponse, normalizeCommonsPoster } from "./commons-poster";

const info = () => ({ mime: "image/jpeg",
  thumburl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Poster.jpg/500px-Poster.jpg",
  descriptionurl: "https://commons.wikimedia.org/wiki/File:Poster.jpg",
  extmetadata: { Artist: { value: '<a href="https://example.com">Studio &amp; Artist</a>' },
    LicenseShortName: { value: "CC BY-SA 4.0" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" } } });
const response = (image = info()) => ({ query: { pages: [{ ns: 6, title: "File:Poster.jpg", imageinfo: [image] }] } });

describe("Commons poster normalization", () => {
  it("keeps filenames bounded and excludes namespaces, URLs and query separators", () => {
    expect(commonsFileName("  Film_poster.JPG  ")).toBe("Film poster.JPG");
    for (const name of ["https://x/Poster.jpg", "File:Poster.jpg", "Poster.jpg|Other.jpg", "Poster.jpg#x", "Poster.html", "x\u0000.jpg"]) expect(commonsFileName(name)).toBeNull();
  });
  it("publishes licensed thumbnails with complete plain-text attribution", () => {
    expect(normalizeCommonsPoster(info())).toMatchObject({ imageUrl: info().thumburl,
      attribution: { artist: "Studio & Artist", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" } });
    expect(attributionText('<script>alert(1)</script><b>Creator</b> &#x26; Co.')).toBe("Creator & Co.");
  });
  it("rejects untrusted image/source/license hosts and incompatible or incomplete licensing", () => {
    expect(normalizeCommonsPoster({ ...info(), thumburl: "https://thumb.wikimedia.org.evil.example/Poster.jpg" })).toBeNull();
    expect(normalizeCommonsPoster({ ...info(), descriptionurl: "javascript:alert(1)" })).toBeNull();
    const value = info();
    value.extmetadata.LicenseUrl.value = "https://example.com/licenses/by-sa/4.0/";
    expect(normalizeCommonsPoster(value)).toBeNull();
    value.extmetadata.LicenseShortName.value = "Fair use";
    expect(normalizeCommonsPoster(value)).toBeNull();
    value.extmetadata.Artist.value = "";
    expect(normalizeCommonsPoster(value)).toBeNull();
  });
  it("accepts explicit public domain and CC0 without treating all Commons images as licensed", () => {
    const value = info() as any;
    value.extmetadata.LicenseShortName.value = "Public domain";
    expect(normalizeCommonsPoster(value)).toBeNull();
    value.extmetadata.Copyrighted = { value: "False" };
    expect(normalizeCommonsPoster(value)?.attribution.license).toBe("Public domain");
    value.extmetadata.LicenseShortName.value = "CC0";
    value.extmetadata.LicenseUrl.value = "http://creativecommons.org/publicdomain/zero/1.0/";
    expect(normalizeCommonsPoster(value)?.attribution.license).toBe("CC0");
  });
  it("handles historical revision continuation while requiring every requested file", () => {
    expect(commonsPostersResponse({ ...response(), continue: { iistart: "2013-01-01", continue: "||" } }, ["Poster.jpg"])["Poster.jpg"]).not.toBeNull();
    expect(() => commonsPostersResponse(response(), ["Poster.jpg", "Missing.jpg"])).toThrow("commons_incomplete_response");
    expect(() => commonsPostersResponse({ ...response(), continue: { batchcomplete: "" } }, ["Poster.jpg"])).toThrow();
  });
  it("fans out normalization and redirects when multiple requested names share one file", () => {
    const body = { query: { ...response().query,
      normalized: [{ from: "File:poster.jpg", to: "File:Poster alias.jpg" }],
      redirects: [{ from: "File:Poster alias.jpg", to: "File:Poster.jpg" }] } };
    const result = commonsPostersResponse(body, ["poster.jpg", "Poster alias.jpg", "Poster.jpg"]);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result["poster.jpg"]).toEqual(result["Poster.jpg"]);
  });
  it("distinguishes authoritative missing files from incomplete or error responses", () => {
    expect(commonsPostersResponse({ query: { pages: [{ ns: 6, title: "File:Poster.jpg", missing: true }] } }, ["Poster.jpg"])).toEqual({ "Poster.jpg": null });
    expect(() => commonsPostersResponse({ query: { pages: [{ ns: 6, title: "File:Poster.jpg" }] } }, ["Poster.jpg"])).toThrow("commons_incomplete_imageinfo");
    expect(() => commonsPostersResponse({ error: { code: "maxlag" } }, ["Poster.jpg"])).toThrow();
  });
});
