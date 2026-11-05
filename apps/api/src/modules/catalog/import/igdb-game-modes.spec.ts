import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { parseGameModeIds, parseGameModeRows } from "./igdb-game-modes";

describe("IGDB game modes", () => {
  it("keeps checked-empty different from an omitted game and normalizes repeated modes", () => {
    expect(parseGameModeRows([{ id: 1 }, { id: 3, game_modes: [3, 1, 1] }], [1, 2, 3])).toEqual([
      { igdbId: 1, gameModeIds: [] }, { igdbId: 3, gameModeIds: [1, 3] },
    ]);
  });

  it.each([null, "1", [0], [-1], [NaN], ["1"], [1.5]])("rejects malformed modes without converting them to none: %s", (raw) => {
    expect(() => parseGameModeIds(raw)).toThrow();
  });

  it.each([
    [{ id: 4 }], [{ id: 1 }, { id: 1 }], [{ id: "1" }], [null], { id: 1 },
  ].map((rows) => ({ rows })))("rejects unexpected, duplicate or invalid provider rows: $rows", ({ rows }) => {
    expect(() => parseGameModeRows(rows, [1, 2])).toThrow();
  });
});
