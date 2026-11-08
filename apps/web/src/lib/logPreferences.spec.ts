import { describe, expect, it } from "vitest";
import { readGameLogPreferences, readMovieLogPreferences, writeGameLogPreferences, writeMovieLogPreferences } from "./logPreferences";

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
}

const today = "2026-11-08";

describe("log preferences", () => {
  it("isolates accounts and media while preserving dates, null and false", () => {
    const storage = memoryStorage();
    writeMovieLogPreferences("a", { watchedOn: "2026-11-07", isPublic: true }, storage);
    writeGameLogPreferences("a", { startedAt: null, completedAt: "2026-11-08", isPublic: false }, storage);
    expect(readMovieLogPreferences("a", true, storage, today)).toEqual({ watchedOn: "2026-11-07", isPublic: true });
    expect(readGameLogPreferences("a", true, storage, today)).toEqual({ startedAt: null, completedAt: "2026-11-08", isPublic: false });
    expect(readMovieLogPreferences("b", true, storage, today)).toEqual({ watchedOn: null, isPublic: false });
    expect(readGameLogPreferences("b", true, storage, today)).toEqual({ startedAt: null, completedAt: null, isPublic: false });
    writeMovieLogPreferences("a", { watchedOn: null, isPublic: false }, storage);
    expect(readMovieLogPreferences("a", true, storage, today)).toEqual({ watchedOn: null, isPublic: false });
  });

  it("never defaults to a public log for a private profile", () => {
    const storage = memoryStorage();
    writeMovieLogPreferences("a", { watchedOn: "2026-11-07", isPublic: true }, storage);
    writeGameLogPreferences("a", { startedAt: "2026-11-07", completedAt: null, isPublic: true }, storage);
    expect(readMovieLogPreferences("a", false, storage, today)).toEqual({ watchedOn: "2026-11-07", isPublic: false });
    expect(readGameLogPreferences("a", false, storage, today)).toEqual({ startedAt: "2026-11-07", completedAt: null, isPublic: false });
    expect(readMovieLogPreferences("a", true, storage, today).isPublic).toBe(true);
  });

  it("ignores malformed, invalid, and future values", () => {
    const storage = memoryStorage();
    storage.setItem("library_log_preferences_v1_movie_a", "not json");
    expect(readMovieLogPreferences("a", true, storage, today)).toEqual({ watchedOn: null, isPublic: false });
    storage.setItem("library_log_preferences_v1_movie_a", JSON.stringify({ watchedOn: "2026-02-30", isPublic: "true" }));
    expect(readMovieLogPreferences("a", true, storage, today)).toEqual({ watchedOn: null, isPublic: false });
    writeGameLogPreferences("a", { startedAt: "2026-11-09", completedAt: "2026-11-08", isPublic: true }, storage);
    expect(readGameLogPreferences("a", true, storage, today)).toEqual({ startedAt: null, completedAt: "2026-11-08", isPublic: true });
    expect(readGameLogPreferences(null, true, storage, today)).toEqual({ startedAt: null, completedAt: null, isPublic: false });
  });

  it("works when storage is unavailable", () => {
    const storage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readMovieLogPreferences("a", true, storage, today)).toEqual({ watchedOn: null, isPublic: false });
    expect(() => writeMovieLogPreferences("a", { watchedOn: null, isPublic: true }, storage)).not.toThrow();
  });
});
