import { describe, expect, it } from "vitest";
import { isActiveStatus, isJobFilter, JOB_FILTERS, LOG_PAGE_SIZE } from "./types";

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
