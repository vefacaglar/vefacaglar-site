import { describe, expect, it } from "vitest";
import type { Dictionary } from "../../../dictionaries";
import { GAME_LOG_STATUSES, statusLabel } from "./gameLogStatus";

describe("GAME_LOG_STATUSES", () => {
  it("lists every status in display order", () => {
    expect(GAME_LOG_STATUSES).toEqual(["playing", "completed", "backlog", "on_hold", "abandoned"]);
  });
});

describe("statusLabel", () => {
  it("reads the `status_<status>` dictionary entry", () => {
    const dict = {
      status_playing: "Playing",
      status_completed: "Completed",
      status_backlog: "Backlog",
      status_on_hold: "On hold",
      status_abandoned: "Abandoned",
    } as unknown as Dictionary;

    expect(GAME_LOG_STATUSES.map((status) => statusLabel(dict, status))).toEqual([
      "Playing",
      "Completed",
      "Backlog",
      "On hold",
      "Abandoned",
    ]);
  });
});
