import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { MeilisearchError, isSearchFallbackError, meilisearchConfigWarning, readMeilisearchConfig, reachablePage, searchFailureEvent } from "./meilisearch.client";
import { describeLogError } from "../application-logs/error-details";

describe("Meilisearch configuration", () => {
  it("enables search for a plain http(s) URL and trims a trailing slash", () => {
    expect(readMeilisearchConfig({ MEILISEARCH_URL: "http://meilisearch:7700/", MEILISEARCH_API_KEY: " k " }))
      .toEqual({ enabled: true, url: "http://meilisearch:7700", apiKey: "k" });
    expect(meilisearchConfigWarning({ MEILISEARCH_URL: "http://meilisearch:7700", NODE_ENV: "production" })).toBeUndefined();
  });

  it.each(["meilisearch:7700", "ftp://host", "http://user:pass@host:7700", "http://host?x=1"])(
    "disables search and warns about an unusable URL (%s) without echoing it", (url) => {
      expect(readMeilisearchConfig({ MEILISEARCH_URL: url }).enabled).toBe(false);
      const warning = meilisearchConfigWarning({ MEILISEARCH_URL: url });
      expect(warning).toMatch(/MEILISEARCH_URL is not a plain http\(s\) URL/);
      expect(warning).not.toContain(url);
    });

  it("warns only in production when no URL is set", () => {
    expect(meilisearchConfigWarning({ NODE_ENV: "production" })).toMatch(/MEILISEARCH_URL is not set/);
    expect(meilisearchConfigWarning({ NODE_ENV: "development" })).toBeUndefined();
  });
});

describe("search error policy", () => {
  const error = (httpStatus: number | undefined, code: string) => new MeilisearchError("x", { httpStatus, code });

  it("falls back on auth failures but reports them as distinct errors", () => {
    for (const err of [error(401, "missing_authorization_header"), error(403, "invalid_api_key")]) {
      expect(isSearchFallbackError(err)).toBe(true);
      expect(searchFailureEvent(err)).toEqual({ event: "search_auth_failure", level: "error" });
    }
    expect(searchFailureEvent(error(503, "http_503"))).toEqual({ event: "search_fallback", level: "warning" });
    expect(isSearchFallbackError(error(400, "invalid_search_page"))).toBe(false);
  });

  it("keeps synthetic HTTP codes in the logged error code", () => {
    expect(describeLogError(error(502, "http_502"))).toMatchObject({ error_code: "meilisearch_http_502", reason: "Meilisearch returned HTTP 502" });
    expect(describeLogError(error(404, "index_not_found")).error_code).toBe("meilisearch_index_not_found");
  });
});

describe("reachablePage", () => {
  const client = (maxTotalHits: number) => ({ maxTotalHits: vi.fn().mockResolvedValue(maxTotalHits) }) as any;

  it("accepts consistent pages without reading pagination settings", async () => {
    const c = client(1000);
    expect(await reachablePage(c, "i", { page: 3, hitsPerPage: 10, totalHits: 25, count: 5 })).toBe(25);
    expect(await reachablePage(c, "i", { page: 9, hitsPerPage: 10, totalHits: 25, count: 0 })).toBe(25);
    expect(c.maxTotalHits).not.toHaveBeenCalled();
  });

  it("caps the total at maxTotalHits for short or empty deep pages", async () => {
    expect(await reachablePage(client(25), "i", { page: 3, hitsPerPage: 10, totalHits: 900, count: 5 })).toBe(25);
    expect(await reachablePage(client(25), "i", { page: 7, hitsPerPage: 10, totalHits: 900, count: 0 })).toBe(25);
  });

  it("rejects pages that are inconsistent even with the cap", async () => {
    expect(await reachablePage(client(1000), "i", { page: 1, hitsPerPage: 10, totalHits: 900, count: 3 })).toBeNull();
    expect(await reachablePage(client(1000), "i", { page: 1, hitsPerPage: 10, totalHits: 2, count: 3 })).toBeNull();
  });
});
