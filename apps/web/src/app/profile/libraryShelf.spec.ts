import { describe, expect, it } from "vitest";
import type { LibraryGame } from "../../lib/profileLibrary";
import {
  activityTime,
  defaultSort,
  parseSort,
  parseTab,
  parseView,
  platformCounts,
  SHELF_TABS,
  shelfQuery,
  sortsFor,
  sortShelf,
} from "./libraryShelf";

function game(overrides: Partial<LibraryGame> = {}): LibraryGame {
  return {
    slug: "game",
    title: "Game",
    coverImageUrl: null,
    status: "playing",
    rating: null,
    playtimeHours: null,
    logCount: 1,
    lastLoggedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    lastActivityAt: "2026-01-01T00:00:00.000Z",
    platformName: null,
    criticScore: null,
    addedAt: "2026-01-01T00:00:00.000Z",
    latestLogId: null,
    ...overrides,
  };
}

const titles = (games: LibraryGame[]) => games.map((g) => g.title);

describe("SHELF_TABS", () => {
  it("is 'all' followed by every game log status in order", () => {
    expect(SHELF_TABS).toEqual(["all", "playing", "completed", "backlog", "on_hold", "abandoned"]);
  });
});

describe("sortsFor / defaultSort", () => {
  it("offers the completion sort only on 'all' and 'completed'", () => {
    expect(sortsFor("all")).toEqual(["activity", "playtime", "completed"]);
    expect(sortsFor("completed")).toEqual(["activity", "playtime", "completed"]);
    for (const tab of ["playing", "backlog", "on_hold", "abandoned"] as const) {
      expect(sortsFor(tab)).toEqual(["activity", "playtime"]);
    }
  });

  it("defaults to completion date on 'completed', activity everywhere else", () => {
    expect(defaultSort("completed")).toBe("completed");
    expect(defaultSort("all")).toBe("activity");
    expect(defaultSort("playing")).toBe("activity");
    expect(defaultSort("abandoned")).toBe("activity");
  });
});

describe("parseTab", () => {
  it("accepts every known tab", () => {
    for (const tab of SHELF_TABS) expect(parseTab(tab)).toBe(tab);
  });

  it("falls back to 'all' for missing, unknown or differently-cased values", () => {
    expect(parseTab(undefined)).toBe("all");
    expect(parseTab("")).toBe("all");
    expect(parseTab("wishlist")).toBe("all");
    expect(parseTab("Completed")).toBe("all");
  });

  it("uses the first value of a repeated param", () => {
    expect(parseTab(["backlog", "completed"])).toBe("backlog");
    expect(parseTab(["nope", "completed"])).toBe("all");
    expect(parseTab([])).toBe("all");
  });
});

describe("parseSort", () => {
  it("accepts a sort that applies to the tab", () => {
    expect(parseSort("playtime", "all")).toBe("playtime");
    expect(parseSort("completed", "all")).toBe("completed");
    expect(parseSort("activity", "completed")).toBe("activity");
    expect(parseSort("playtime", "backlog")).toBe("playtime");
  });

  it("falls back to the tab default when missing or unknown", () => {
    expect(parseSort(undefined, "all")).toBe("activity");
    expect(parseSort(undefined, "completed")).toBe("completed");
    expect(parseSort("rating", "completed")).toBe("completed");
    expect(parseSort("", "playing")).toBe("activity");
  });

  it("falls back to the tab default when the sort doesn't apply to the tab", () => {
    expect(parseSort("completed", "playing")).toBe("activity");
    expect(parseSort("completed", "on_hold")).toBe("activity");
  });

  it("uses the first value of a repeated param", () => {
    expect(parseSort(["playtime", "activity"], "all")).toBe("playtime");
  });
});

describe("parseView", () => {
  it("is 'list' only for exactly 'list'", () => {
    expect(parseView("list")).toBe("list");
    expect(parseView(["list", "grid"])).toBe("list");
  });

  it("defaults to 'grid'", () => {
    expect(parseView(undefined)).toBe("grid");
    expect(parseView("grid")).toBe("grid");
    expect(parseView("LIST")).toBe("grid");
    expect(parseView(["grid", "list"])).toBe("grid");
  });
});

describe("shelfQuery", () => {
  it("is empty when everything is the default", () => {
    expect(shelfQuery("all", "activity")).toBe("");
    expect(shelfQuery("all", "activity", "grid")).toBe("");
  });

  it("omits the sort when it is the tab default", () => {
    expect(shelfQuery("completed", "completed")).toBe("?status=completed");
    expect(shelfQuery("on_hold", "activity")).toBe("?status=on_hold");
  });

  it("includes non-default status, sort and view in that order", () => {
    expect(shelfQuery("completed", "activity")).toBe("?status=completed&sort=activity");
    expect(shelfQuery("all", "playtime", "list")).toBe("?sort=playtime&view=list");
    expect(shelfQuery("backlog", "playtime", "list")).toBe("?status=backlog&sort=playtime&view=list");
    expect(shelfQuery("all", "activity", "list")).toBe("?view=list");
  });

  it("does not validate the sort against the tab", () => {
    expect(shelfQuery("playing", "completed")).toBe("?status=playing&sort=completed");
  });
});

describe("platformCounts", () => {
  it("counts games per platform, most first, then by name", () => {
    const games = [
      game({ platformName: "PC" }),
      game({ platformName: "Switch" }),
      game({ platformName: "PC" }),
      game({ platformName: "PS5" }),
      game({ platformName: "Switch" }),
      game({ platformName: "Deck" }),
    ];
    expect(platformCounts(games)).toEqual([
      { name: "PC", count: 2 },
      { name: "Switch", count: 2 },
      { name: "Deck", count: 1 },
      { name: "PS5", count: 1 },
    ]);
  });

  it("leaves out games without a platform (null or empty)", () => {
    expect(platformCounts([game({ platformName: null }), game({ platformName: "" }), game({ platformName: "PC" })])).toEqual([
      { name: "PC", count: 1 },
    ]);
  });

  it("is empty for no games", () => {
    expect(platformCounts([])).toEqual([]);
  });
});

describe("activityTime", () => {
  it("uses lastActivityAt", () => {
    expect(activityTime(game({ lastActivityAt: "2026-03-01T00:00:00.000Z" }))).toBe(Date.parse("2026-03-01T00:00:00.000Z"));
  });

  it("falls back to lastLoggedAt when lastActivityAt is missing or unreadable", () => {
    const lastLoggedAt = "2025-12-24T10:00:00.000Z";
    expect(activityTime(game({ lastActivityAt: undefined as unknown as string, lastLoggedAt }))).toBe(Date.parse(lastLoggedAt));
    expect(activityTime(game({ lastActivityAt: "not a date", lastLoggedAt }))).toBe(Date.parse(lastLoggedAt));
  });

  it("is 0 when neither timestamp is readable", () => {
    expect(activityTime(game({ lastActivityAt: "", lastLoggedAt: "" }))).toBe(0);
  });
});

describe("sortShelf", () => {
  it("sorts by latest activity, newest first, by default ('activity')", () => {
    const games = [
      game({ title: "Old", lastActivityAt: "2024-01-01T00:00:00Z" }),
      game({ title: "New", lastActivityAt: "2026-01-01T00:00:00Z" }),
      game({ title: "Mid", lastActivityAt: "2025-01-01T00:00:00Z" }),
    ];
    expect(titles(sortShelf(games, "activity"))).toEqual(["New", "Mid", "Old"]);
  });

  it("uses the lastLoggedAt fallback when sorting by activity, unreadable last", () => {
    const games = [
      game({ title: "None", lastActivityAt: "", lastLoggedAt: "" }),
      game({ title: "Fallback", lastActivityAt: "", lastLoggedAt: "2026-06-01T00:00:00Z" }),
      game({ title: "Activity", lastActivityAt: "2026-01-01T00:00:00Z" }),
    ];
    expect(titles(sortShelf(games, "activity"))).toEqual(["Fallback", "Activity", "None"]);
  });

  it("breaks activity ties by title", () => {
    const at = "2026-01-01T00:00:00Z";
    const games = [game({ title: "Celeste", lastActivityAt: at }), game({ title: "Abzu", lastActivityAt: at }), game({ title: "Braid", lastActivityAt: at })];
    expect(titles(sortShelf(games, "activity"))).toEqual(["Abzu", "Braid", "Celeste"]);
  });

  it("sorts by playtime, most first, missing playtime last, ties by title", () => {
    const games = [
      game({ title: "Zero", playtimeHours: 0 }),
      game({ title: "Unknown B", playtimeHours: null }),
      game({ title: "Long", playtimeHours: 120.5 }),
      game({ title: "Unknown A", playtimeHours: null }),
      game({ title: "Short B", playtimeHours: 3 }),
      game({ title: "Short A", playtimeHours: 3 }),
    ];
    expect(titles(sortShelf(games, "playtime"))).toEqual(["Long", "Short A", "Short B", "Zero", "Unknown A", "Unknown B"]);
  });

  it("sorts by completion date, latest first, never-finished last, ties by title", () => {
    const games = [
      game({ title: "Never", completedAt: null }),
      game({ title: "2024", completedAt: "2024-05-01" }),
      game({ title: "2025 B", completedAt: "2025-02-10" }),
      game({ title: "2025 A", completedAt: "2025-02-10T23:59:00Z" }),
      game({ title: "2026", completedAt: "2026-01-31" }),
      game({ title: "Bad", completedAt: "soon" }),
    ];
    expect(titles(sortShelf(games, "completed"))).toEqual(["2026", "2025 A", "2025 B", "2024", "Bad", "Never"]);
  });

  it("compares completion dates by day only (time of day ignored)", () => {
    const games = [
      game({ title: "B", completedAt: "2025-02-10T23:00:00Z" }),
      game({ title: "A", completedAt: "2025-02-10T01:00:00Z" }),
    ];
    expect(titles(sortShelf(games, "completed"))).toEqual(["A", "B"]);
  });

  it("returns a new array and leaves the input untouched", () => {
    const games = [game({ title: "B", playtimeHours: 1 }), game({ title: "A", playtimeHours: 2 })];
    const sorted = sortShelf(games, "playtime");
    expect(sorted).not.toBe(games);
    expect(titles(games)).toEqual(["B", "A"]);
    expect(titles(sorted)).toEqual(["A", "B"]);
  });
});
