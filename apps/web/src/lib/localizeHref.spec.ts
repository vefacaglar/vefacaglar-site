import { describe, expect, it } from "vitest";
import { localizeHref } from "./localizeHref";

describe("localizeHref", () => {
  it("leaves hrefs unchanged for any language other than 'tr'", () => {
    expect(localizeHref("/blog", "en")).toBe("/blog");
    expect(localizeHref("/blog?x=1#a", "de")).toBe("/blog?x=1#a");
    expect(localizeHref("/blog", "TR")).toBe("/blog");
  });

  it("adds ?lang=tr", () => {
    expect(localizeHref("/blog", "tr")).toBe("/blog?lang=tr");
    expect(localizeHref("/", "tr")).toBe("/?lang=tr");
  });

  it("appends to an existing query", () => {
    expect(localizeHref("/blog?page=2", "tr")).toBe("/blog?page=2&lang=tr");
  });

  it("replaces an existing lang param", () => {
    expect(localizeHref("/blog?lang=en&page=2", "tr")).toBe("/blog?lang=tr&page=2");
  });

  it("keeps the hash after the query", () => {
    expect(localizeHref("/blog#top", "tr")).toBe("/blog?lang=tr#top");
    expect(localizeHref("/blog?x=1#top", "tr")).toBe("/blog?x=1&lang=tr#top");
    expect(localizeHref("/blog#", "tr")).toBe("/blog?lang=tr#");
  });

  it("falls back to '/' when the href has no path", () => {
    expect(localizeHref("", "tr")).toBe("/?lang=tr");
    expect(localizeHref("?q=1", "tr")).toBe("/?q=1&lang=tr");
    expect(localizeHref("#a", "tr")).toBe("/?lang=tr#a");
  });

  it("re-encodes the query through URLSearchParams", () => {
    expect(localizeHref("/search?q=a%20b", "tr")).toBe("/search?q=a+b&lang=tr");
  });

  it("does not check that the href is internal", () => {
    expect(localizeHref("https://example.com/a", "tr")).toBe("https://example.com/a?lang=tr");
  });

  it("drops anything after a second '#' or '?'", () => {
    // NOTE: `split(sep, 2)` truncates rather than splitting once, so extra parts are lost.
    expect(localizeHref("/a#b#c", "tr")).toBe("/a?lang=tr#b");
    expect(localizeHref("/a?b=1?c=2", "tr")).toBe("/a?b=1&lang=tr");
  });
});
