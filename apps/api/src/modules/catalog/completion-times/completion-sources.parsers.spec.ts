import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { backloggdAllowed, parseBackloggd, parseCompletionMappings, parseIfdb, parseVndb } from "./completion-sources.parsers";

const at = new Date("2026-11-22T00:00:00Z");
const identity = { igdbId: 1, slug: "test-game", wikidataId: "Q1", ifdbId: "abcdefghijklmnop", vndbId: "v1" };
const stat = (value: number, label: string, revealed = true) => `<p class="stat-value ${revealed ? "element-revealed" : "element-hidden"}">${value}<small>h</small></p><p class="stat-value element-hidden">Hidden</p><p class="label">${label}</p>`;
const link = '<a href="https://www.igdb.com/games/test-game">IGDB</a>';
const binding = (slug: string, ifdbId: string, qid = "Q1") => ({ igdb: { value: slug }, item: { value: `http://www.wikidata.org/entity/${qid}` }, ifdb: { value: ifdbId } });

describe("completion source identity and semantics", () => {
  it("accepts public revealed finish/master values and ignores lifetime average", () => {
    const report = parseBackloggd(link + stat(200, "average") + stat(30, "to finish") + stat(50, "to master"), identity, at);
    expect(report).toMatchObject({ finishSeconds: 108000, masterSeconds: 180000, playtimeSeconds: null, sampleCount: null });
  });
  it("does not extract a hidden placeholder or an unauthenticated challenge", () => {
    expect(parseBackloggd(link + stat(30, "to finish", false), identity, at)).toBeNull();
    expect(() => parseBackloggd("Just a moment... cf-chl-token", identity, at)).toThrow("challenge");
    expect(() => parseBackloggd("Temporary maintenance", identity, at)).toThrow("identity_unverified");
  });
  it("rejects another edition's backlink and conflicting duplicated layouts", () => {
    expect(() => parseBackloggd('<a href="https://www.igdb.com/games/test-game-remake">IGDB</a>' + stat(30, "to finish"), identity, at)).toThrow("identity");
    expect(() => parseBackloggd(link + stat(30, "to finish") + stat(60, "to finish"), identity, at)).toThrow("conflicting");
  });
  it("honors site robots paths for the identified product client", () => {
    const robots = 'User-agent: GPTBot\nDisallow: /\nUser-agent: *\nDisallow: /api/\nDisallow: /games/*/*/';
    expect(backloggdAllowed(robots, "test-game")).toBe(true);
    expect(backloggdAllowed('User-agent: *\nDisallow: /games/', "test-game")).toBe(false);
    expect(backloggdAllowed('User-agent: VefaLibrary\nDisallow: /\nUser-agent: *\nAllow: /', "test-game")).toBe(false);
    expect(backloggdAllowed(robots, "../private")).toBe(false);
  });
  it("excludes ambiguous external IDs, duplicate editions and conflicting Wikidata owners", () => {
    const raw = { results: { bindings: [binding("test-game", "abcdefghijklmnop"), binding("test-game-remake", "abcdefghijklmnop")] } };
    expect(parseCompletionMappings(raw)).toEqual([]);
    expect(parseCompletionMappings({ results: { bindings: [binding("test-game", "abcdefghijklmnop"), binding("test-game", "ponmlkjihgfedcba")] } })).toEqual([]);
    expect(parseCompletionMappings({ results: { bindings: [binding("test-game", "abcdefghijklmnop"), binding("test-game", "abcdefghijklmnop", "Q2")] } })).toEqual([]);
    expect(parseCompletionMappings({ results: { bindings: [binding("test-game", "abcdefghijklmnop")] } })).toHaveLength(1);
  });
  it("only accepts exact IFDB TUID values and does not substitute review counts", () => {
    expect(parseIfdb({ games: [{ tuid: identity.ifdbId, playTimeInMinutes: 90, numRatings: 500 }] }, identity, at))
      .toMatchObject({ finishSeconds: 5400, statistic: "median_finish", sampleCount: null });
    expect(() => parseIfdb({ games: [{ tuid: "another-game", playTimeInMinutes: 90 }] }, identity, at)).toThrow("identity");
  });
  it("keeps VNDB average play time distinct and validates explicit cross-links", () => {
    const raw = { more: false, results: [{ id: "v1", length_minutes: 120, length_votes: 10, extlinks: [{ name: "igdb_game", id: "test-game" }] }] };
    expect(parseVndb(raw, [identity], at).get(1)).toMatchObject({ playtimeSeconds: 7200, finishSeconds: null, sampleCount: 10 });
    raw.results[0].extlinks[0].id = "test-game-remake";
    expect(parseVndb(raw, [identity], at).get(1)).toBeNull();
    expect(() => parseVndb({ more: true, results: [] }, [identity], at)).toThrow("incomplete");
  });
});
