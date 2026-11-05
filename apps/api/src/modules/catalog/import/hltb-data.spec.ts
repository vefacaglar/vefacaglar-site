import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { hltbApiPath, hltbEngagement, hltbScriptUrls, matchHltbGames, parseHltbGames, parseHltbSession } from "./hltb-data";
import type { PopularitySource } from "../games.repository.interface";
import type { HltbPopularityGame } from "./import.types";

const source = (patch: Partial<PopularitySource> = {}): PopularitySource => ({
  id: "a", igdbId: 1, title: "Doom", originalTitle: null, releaseDate: "1993-12-10", hltb: null,
  igdbRatingCount: null, popularityScore: null, ...patch,
});
const entry = (patch: Partial<HltbPopularityGame> = {}): HltbPopularityGame => ({
  hltbId: 10, title: "Doom", releaseYear: 1993, completed: 120, backlog: 20, playing: 0,
  times: { mainHours: 5, mainExtraHours: null, completionistHours: null }, ...patch,
});

describe("HLTB public response parsing", () => {
  it("validates counts, converts seconds and omits DLC/invalid rows", () => {
    expect(parseHltbGames({ data: [
      { game_id: 10, game_name: "Doom", game_type: "game", release_world: 1993, count_comp: 120, count_backlog: -1, count_playing: 0, comp_main: 18_000, comp_plus: 0, comp_100: "bad" },
      { game_id: 11, game_name: "Doom DLC", game_type: "dlc" },
      { game_id: "12", game_name: "Invalid" },
    ] })).toEqual([{ ...entry(), backlog: null }]);
    expect(() => parseHltbGames({ result: [] })).toThrow("invalid game list");
  });

  it("discovers only same-origin scripts and public POST API paths", () => {
    expect(hltbScriptUrls('<script src="https://evil.test/a.js"></script><script src="/_next/static/pages/main.js"></script>')).toEqual(["https://howlongtobeat.com/_next/static/pages/main.js"]);
    expect(hltbApiPath('fetch("/api/finder/v2",{method:"POST",body:a})')).toBe("/api/finder/v2");
    expect(hltbApiPath('fetch("https://evil.test/api/find",{method:"POST"})')).toBeNull();
    expect(hltbApiPath('fetch("/api/../find",{method:"POST"})')).toBeNull();
  });

  it("accepts public session metadata without exposing it in validation errors", () => {
    expect(parseHltbSession({ token: "session", authKey: "field", authVal: "value" })).toEqual({ token: "session", key: "field", value: "value" });
    expect(() => parseHltbSession({ token: null })).toThrow("invalid session");
  });
});

describe("HLTB catalog matching", () => {
  it("matches exact normalized titles and rejects a remake's mismatched year", () => {
    expect(matchHltbGames([source()], [entry()]).get("a")?.hltbId).toBe(10);
    expect(matchHltbGames([source()], [entry({ releaseYear: 2016 })]).size).toBe(0);
    expect(matchHltbGames([source()], [entry({ title: "Doom 2" })]).size).toBe(0);
  });

  it("rejects ambiguous catalog titles and duplicate HLTB editions", () => {
    expect(matchHltbGames([source(), source({ id: "b" })], [entry()]).size).toBe(0);
    expect(matchHltbGames([source()], [entry(), entry({ hltbId: 11 }), entry({ hltbId: 12 })]).size).toBe(0);
  });

  it("uses a stable verified id without reassigning it to a title collision", () => {
    const linked = source({ hltb: { hltbId: 10, completed: 1, backlog: null, playing: null, updatedAt: new Date() } });
    expect(matchHltbGames([linked, source({ id: "b" })], [entry()]).get("a")?.hltbId).toBe(10);
    expect(matchHltbGames([linked], [entry({ hltbId: 11 })]).size).toBe(0);
  });

  it("keeps missing engagement unknown while retaining real zero counts", () => {
    expect(hltbEngagement(null)).toBeNull();
    expect(hltbEngagement({ completed: null, backlog: null, playing: null })).toBeNull();
    expect(hltbEngagement({ completed: 20, backlog: null, playing: 0 })).toBe(20);
    expect(hltbEngagement({ completed: 0, backlog: null, playing: null })).toBe(0);
  });

  it("scores seven-day snapshots and ignores older counts at the same clock time", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const counts = { completed: 20, backlog: 10, playing: 0 };
    expect(hltbEngagement({ ...counts, updatedAt: new Date("2026-10-29T12:00:00Z") }, now)).toBe(30);
    expect(hltbEngagement({ ...counts, updatedAt: new Date("2026-10-29T11:59:59Z") }, now)).toBeNull();
  });
});
