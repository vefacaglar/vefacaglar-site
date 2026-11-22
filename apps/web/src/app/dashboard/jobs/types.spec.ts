import { describe, expect, it } from "vitest";
import { isActiveStatus, isJobFilter, JOB_FILTERS, LOG_PAGE_SIZE, hasConcurrencyConflict, type RecurringJob } from "./types";

describe("isActiveStatus", () => {
  it("is true only for queued and running", () => {
    expect(isActiveStatus("queued")).toBe(true);
    expect(isActiveStatus("running")).toBe(true);
    expect(isActiveStatus("succeeded")).toBe(false);
    expect(isActiveStatus("failed")).toBe(false);
    expect(isActiveStatus("cancelled")).toBe(false);
  });
});

describe("isJobFilter", () => {
  it("accepts every run-list filter", () => {
    expect(JOB_FILTERS).toEqual(["processing", "succeeded", "failed", "cancelled"]);
    for (const filter of JOB_FILTERS) expect(isJobFilter(filter)).toBe(true);
  });

  it("rejects raw statuses, unknown and missing values", () => {
    expect(isJobFilter("queued")).toBe(false);
    expect(isJobFilter("running")).toBe(false);
    expect(isJobFilter("Processing")).toBe(false);
    expect(isJobFilter("")).toBe(false);
    expect(isJobFilter(undefined)).toBe(false);
  });
});

describe("LOG_PAGE_SIZE", () => {
  it("matches the API's log page size", () => {
    expect(LOG_PAGE_SIZE).toBe(200);
  });
});


const registration = (id: string, concurrencyKey: string | null) => ({ id, concurrencyKey }) as RecurringJob;

describe("registered job concurrency", () => {
  it("blocks only another registration with the same non-null key", () => {
    const games = registration("catalog.popularity.refresh", "search.index");
    expect(hasConcurrencyConflict(games, registration("search.sync", "search.index"))).toBe(true);
    expect(hasConcurrencyConflict(games, registration("search.movies.sync", "search.movies.index"))).toBe(false);
    expect(hasConcurrencyConflict(games, games)).toBe(false);
    expect(hasConcurrencyConflict(registration("a", null), registration("b", null))).toBe(false);
  });
});
