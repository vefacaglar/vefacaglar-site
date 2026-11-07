import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safePath";

describe("safeInternalPath", () => {
  it("returns same-site paths unchanged", () => {
    expect(safeInternalPath("/")).toBe("/");
    expect(safeInternalPath("/blog?x=1")).toBe("/blog?x=1");
    expect(safeInternalPath("/explore/games/elden-ring?lang=tr#logs")).toBe("/explore/games/elden-ring?lang=tr#logs");
    expect(safeInternalPath("/a/b\\c")).toBe("/a/b\\c");
  });

  it("returns percent-encoded paths as-is", () => {
    expect(safeInternalPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
  });

  it("rejects missing values", () => {
    expect(safeInternalPath(undefined)).toBeUndefined();
    expect(safeInternalPath(null)).toBeUndefined();
    expect(safeInternalPath("")).toBeUndefined();
  });

  it("rejects relative and absolute URLs", () => {
    expect(safeInternalPath("blog")).toBeUndefined();
    expect(safeInternalPath("http://evil.com")).toBeUndefined();
    expect(safeInternalPath("https://evil.com/")).toBeUndefined();
    expect(safeInternalPath("javascript:alert(1)")).toBeUndefined();
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeInternalPath("//evil.com")).toBeUndefined();
    expect(safeInternalPath("/\\evil.com")).toBeUndefined();
  });

  it("rejects control characters and whitespace", () => {
    expect(safeInternalPath("/\t/evil.com")).toBeUndefined();
    expect(safeInternalPath("/\n/evil.com")).toBeUndefined();
    expect(safeInternalPath("/a b")).toBeUndefined();
    expect(safeInternalPath("/a\u0000")).toBeUndefined();
    expect(safeInternalPath("/a\u007f")).toBeUndefined();
    expect(safeInternalPath("/a\u00a0b")).toBeUndefined();
  });
});
