import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../../../lib/httpClient", () => ({ httpClient: { put: vi.fn(), get: vi.fn() } }));
import { cookies } from "next/headers";
import { httpClient } from "../../../lib/httpClient";
import { setTvPersonalNote, setTvPersonalRating } from "./preferences.actions";
const preferences = { rating: 8, note: "Note", ratingVersion: 3, noteVersion: 2 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: "owner-token" }) } as never);
});
describe("private TV preferences actions", () => {
  it("requires a session and makes no anonymous mutation", async () => {
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    expect((await setTvPersonalRating(1, 8, 0)).error).toMatch(/sign in/i);
    expect(httpClient.put).not.toHaveBeenCalled();
  });
  it("normalizes the note and sends only its own field and version", async () => {
    vi.mocked(httpClient.put).mockResolvedValue(Response.json(preferences));
    expect(await setTvPersonalNote(1, "  Note  ", 1)).toEqual({ preferences });
    expect(httpClient.put).toHaveBeenCalledWith("/api/tv-series/1/preferences/note", { note: "Note", expectedVersion: 1 }, { headers: { Authorization: "Bearer owner-token" } });
  });
  it("explicitly clears a note with null", async () => {
    vi.mocked(httpClient.put).mockResolvedValue(Response.json({ ...preferences, note: null }));
    await setTvPersonalNote(1, " ", 2);
    expect(httpClient.put).toHaveBeenCalledWith(expect.any(String), { note: null, expectedVersion: 2 }, expect.any(Object));
  });
  it("reloads the latest owner values after a conflict", async () => {
    vi.mocked(httpClient.put).mockResolvedValue(new Response("{}", { status: 409 }));
    vi.mocked(httpClient.get).mockResolvedValue(Response.json(preferences));
    const result = await setTvPersonalRating(1, 9, 1);
    expect(result.conflict).toBe(true);
    expect(result.preferences).toEqual(preferences);
    expect(result.error).toContain("draft is preserved");
    expect(httpClient.get).toHaveBeenCalledWith("/api/tv-series/1/preferences", { headers: { Authorization: "Bearer owner-token" }, cache: "no-store" });
  });
  it("keeps a failed conflict reload distinct from a confirmed saved value", async () => {
    vi.mocked(httpClient.put).mockResolvedValue(new Response("{}", { status: 409 }));
    vi.mocked(httpClient.get).mockResolvedValue(new Response("{}", { status: 503 }));
    const result = await setTvPersonalRating(1, 9, 1);
    expect(result.preferences).toBeUndefined();
    expect(result.conflict).toBeUndefined();
    expect(result.error).toContain("could not be reloaded");
  });
  it("keeps drafts retryable through network failure", async () => {
    vi.mocked(httpClient.put).mockRejectedValue(new Error("offline"));
    expect((await setTvPersonalNote(1, "Draft", 2)).error).toContain("draft is preserved");
  });
  it("validates ratings and note limits before sending", async () => {
    expect((await setTvPersonalRating(1, 0, 0)).error).toContain("1 to 10");
    expect((await setTvPersonalNote(1, "x".repeat(2001), 0)).error).toContain("2,000");
    expect(httpClient.put).not.toHaveBeenCalled();
  });
});
