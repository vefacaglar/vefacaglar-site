import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { wikidataRetryAfter } from "./wikidata-retry-after";

describe("Wikidata Retry-After parsing", () => {
  const now = Date.parse("2026-11-06T00:00:00Z");
  it("preserves a finite long numeric cooldown", () => {
    expect(wikidataRetryAfter("259200", now)?.getTime()).toBe(now + 3 * 86_400_000);
  });
  it("accepts an HTTP date and rejects malformed or overflowing values", () => {
    expect(wikidataRetryAfter("Mon, 09 Nov 2026 00:00:00 GMT", now)?.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    for (const invalid of [null, "garbage", "9".repeat(400), "99999999999999999999"]) {
      expect(wikidataRetryAfter(invalid, now)).toBeUndefined();
    }
  });
});
