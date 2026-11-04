import { afterEach, describe, expect, it, vi } from "vitest";

// SITE_URL is read from the environment at import time, so each test loads a fresh module.
async function loadSeo(siteUrl: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  vi.resetModules();
  return import("./seo");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SITE_URL", () => {
  it("defaults to the production site", async () => {
    expect((await loadSeo(undefined)).SITE_URL).toBe("https://vefacaglar.com");
    expect((await loadSeo("")).SITE_URL).toBe("https://vefacaglar.com");
  });

  it("uses NEXT_PUBLIC_SITE_URL without a single trailing slash", async () => {
    expect((await loadSeo("http://localhost:3000/")).SITE_URL).toBe("http://localhost:3000");
    // NOTE: only one trailing slash is removed.
    expect((await loadSeo("http://localhost:3000//")).SITE_URL).toBe("http://localhost:3000/");
  });
});

describe("DEFAULT_OG_IMAGE", () => {
  it("is the shared og.png card", async () => {
    expect((await loadSeo(undefined)).DEFAULT_OG_IMAGE).toEqual({ url: "/og.png", width: 1200, height: 630, alt: "vefa çağlar" });
  });
});

describe("localizedAlternates", () => {
  it("builds English canonical + hreflang alternates for bilingual pages", async () => {
    const { localizedAlternates } = await loadSeo("https://site.test");
    expect(localizedAlternates("/blog/foo", "en")).toEqual({
      canonical: "https://site.test/blog/foo",
      languages: {
        en: "https://site.test/blog/foo",
        tr: "https://site.test/blog/foo?lang=tr",
        "x-default": "https://site.test/blog/foo",
      },
      types: { "application/rss+xml": "https://site.test/rss.xml" },
    });
  });

  it("points the canonical and RSS feed at the Turkish variant for 'tr'", async () => {
    const { localizedAlternates } = await loadSeo("https://site.test");
    expect(localizedAlternates("/blog/foo", "tr")).toEqual({
      canonical: "https://site.test/blog/foo?lang=tr",
      languages: {
        en: "https://site.test/blog/foo",
        tr: "https://site.test/blog/foo?lang=tr",
        "x-default": "https://site.test/blog/foo",
      },
      types: { "application/rss+xml": "https://site.test/rss.xml?lang=tr" },
    });
  });

  it("treats '' and '/' as the home page", async () => {
    const { localizedAlternates } = await loadSeo("https://site.test");
    const expected = {
      canonical: "https://site.test",
      languages: { en: "https://site.test", tr: "https://site.test/?lang=tr", "x-default": "https://site.test" },
      types: { "application/rss+xml": "https://site.test/rss.xml" },
    };
    expect(localizedAlternates("", "en")).toEqual(expected);
    expect(localizedAlternates("/", "en")).toEqual(expected);
  });

  it("always uses the English canonical for English-only sections", async () => {
    const { localizedAlternates } = await loadSeo("https://site.test");
    const expected = { canonical: "https://site.test/packages/x", types: { "application/rss+xml": "https://site.test/rss.xml" } };
    expect(localizedAlternates("/packages/x", "en", { bilingual: false })).toEqual(expected);
    expect(localizedAlternates("/packages/x", "tr", { bilingual: false })).toEqual(expected);
  });

  it("is bilingual when the option is omitted", async () => {
    const { localizedAlternates } = await loadSeo("https://site.test");
    expect(localizedAlternates("/a", "en", {})).toHaveProperty("languages");
  });
});
