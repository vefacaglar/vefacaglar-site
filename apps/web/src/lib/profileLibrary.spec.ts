import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  get: vi.fn(),
}));

// `cache` memoizes per request in React Server Components; here it must be a pass-through.
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet }) }));
vi.mock("./httpClient", () => ({ httpClient: { get: mocks.get } }));

import { decodeUsername, getProfileLibrary, PROFILE_VISIBILITY_PATH, profilePath } from "./profileLibrary";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const baseGame = {
  slug: "hades",
  title: "Hades",
  coverImageUrl: null,
  status: "completed",
  rating: 9,
  playtimeHours: 40,
  logCount: 2,
  lastLoggedAt: "2026-01-02T00:00:00.000Z",
  completedAt: "2026-01-01",
  lastActivityAt: "2026-01-03T00:00:00.000Z",
};

const summary = { gameCount: 1, logCount: 2, completedCount: 1, playtimeHours: 40, averageRating: 9 };
const user = { username: "vefa", displayName: "Vefa", isProfilePublic: true };

afterEach(() => {
  vi.resetAllMocks();
});

describe("PROFILE_VISIBILITY_PATH", () => {
  it("points at the visibility endpoint", () => {
    expect(PROFILE_VISIBILITY_PATH).toBe("/api/auth/profile/visibility");
  });
});

describe("getProfileLibrary", () => {
  it("requests the encoded username without auth when signed out", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.get.mockResolvedValue(json({}, 404));

    await getProfileLibrary("vefa çağlar/x");

    expect(mocks.cookieGet).toHaveBeenCalledWith("session_token");
    expect(mocks.get).toHaveBeenCalledWith("/api/games/users/vefa%20%C3%A7a%C4%9Flar%2Fx/library", { headers: undefined });
  });

  it("sends the session token when present", async () => {
    mocks.cookieGet.mockReturnValue({ value: "tok" });
    mocks.get.mockResolvedValue(json({}, 404));

    await getProfileLibrary("vefa");

    expect(mocks.get).toHaveBeenCalledWith("/api/games/users/vefa/library", { headers: { Authorization: "Bearer tok" } });
  });

  it("maps 401 to private for a signed-out viewer", async () => {
    mocks.get.mockResolvedValue(json({}, 401));
    await expect(getProfileLibrary("vefa")).resolves.toEqual({ kind: "private", signedIn: false });
  });

  it("maps 403 to private for a signed-in viewer", async () => {
    mocks.get.mockResolvedValue(json({}, 403));
    await expect(getProfileLibrary("vefa")).resolves.toEqual({ kind: "private", signedIn: true });
  });

  it("maps 404 to not_found", async () => {
    mocks.get.mockResolvedValue(json({}, 404));
    await expect(getProfileLibrary("vefa")).resolves.toEqual({ kind: "not_found" });
  });

  it("throws on any other failure", async () => {
    mocks.get.mockResolvedValue(json({}, 500));
    await expect(getProfileLibrary("vefa")).rejects.toThrow("Profile library fetch failed: 500");

    mocks.get.mockResolvedValue(json({}, 400));
    await expect(getProfileLibrary("vefa")).rejects.toThrow("Profile library fetch failed: 400");
  });

  it("passes a complete response through unchanged", async () => {
    const game = {
      ...baseGame,
      platformName: "PC",
      criticScore: 93,
      addedAt: "2025-12-01T00:00:00.000Z",
      latestLogId: "log-1",
    };
    const data = { user, summary: { ...summary, platforms: [{ name: "PC", count: 1 }] }, games: [game], isOwner: true };
    mocks.get.mockResolvedValue(json(data));

    await expect(getProfileLibrary("vefa")).resolves.toEqual({ kind: "ok", data });
  });

  it("fills fields an older API doesn't send", async () => {
    mocks.get.mockResolvedValue(json({ user, summary, games: [baseGame], isOwner: false }));

    const res = await getProfileLibrary("vefa");

    expect(res).toEqual({
      kind: "ok",
      data: {
        user,
        isOwner: false,
        summary: { ...summary, platforms: [] },
        games: [
          {
            ...baseGame,
            platformName: null,
            criticScore: null,
            addedAt: baseGame.lastLoggedAt,
            latestLogId: null,
          },
        ],
      },
    });
  });

  it("keeps a critic score of 0 but drops non-numeric scores", async () => {
    mocks.get.mockResolvedValue(
      json({
        user,
        summary,
        games: [
          { ...baseGame, slug: "a", criticScore: 0 },
          { ...baseGame, slug: "b", criticScore: "85" },
          { ...baseGame, slug: "c", criticScore: null },
        ],
      })
    );

    const res = await getProfileLibrary("vefa");

    expect(res.kind === "ok" && res.data.games.map((g) => g.criticScore)).toEqual([0, null, null]);
  });

  it("defaults missing games and non-array platforms to empty lists", async () => {
    mocks.get.mockResolvedValue(json({ user, summary: { ...summary, platforms: "PC" }, isOwner: false }));

    const res = await getProfileLibrary("vefa");

    expect(res.kind === "ok" && res.data.games).toEqual([]);
    expect(res.kind === "ok" && res.data.summary.platforms).toEqual([]);
  });

  it("tolerates a missing summary", async () => {
    mocks.get.mockResolvedValue(json({ user, games: [], isOwner: false }));

    const res = await getProfileLibrary("vefa");

    expect(res.kind === "ok" && res.data.summary).toEqual({ platforms: [] });
  });
});

describe("profilePath", () => {
  it("builds the profile path with an encoded username", () => {
    expect(profilePath("vefa")).toBe("/profile/vefa");
    expect(profilePath("vefa çağlar")).toBe("/profile/vefa%20%C3%A7a%C4%9Flar");
    expect(profilePath("a/b")).toBe("/profile/a%2Fb");
  });

  it("appends a sub-page", () => {
    expect(profilePath("vefa", "games")).toBe("/profile/vefa/games");
    expect(profilePath("vefa", "movies")).toBe("/profile/vefa/movies");
  });
});

describe("decodeUsername", () => {
  it("decodes encoded usernames", () => {
    expect(decodeUsername("vefa%20%C3%A7a%C4%9Flar")).toBe("vefa çağlar");
  });

  it("leaves plain usernames alone", () => {
    expect(decodeUsername("vefa")).toBe("vefa");
  });

  it("returns the raw value for malformed escapes", () => {
    expect(decodeUsername("100%")).toBe("100%");
    expect(decodeUsername("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
