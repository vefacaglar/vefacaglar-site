import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { parseHltbOptions } from "./hltb-options";
describe("HLTB CLI options", () => {
  it("defaults to dry-run lookup", () => { expect(parseHltbOptions(["--game", "elden-ring"])).toMatchObject({ game: "elden-ring", apply: false, overwriteFields: [] }); });
  it("requires explicit apply, candidate and overwrite choices", () => { expect(parseHltbOptions(["--game", "game", "--apply", "--hltb-id", "1", "--overwrite", "mainHours,mainExtraHours", "--replace-mapping", "--acknowledge-mismatch"])).toMatchObject({ apply: true, hltbId: 1, overwriteFields: ["mainHours", "mainExtraHours"], replaceMapping: true, acknowledgeMismatch: true }); });
  it.each([[], ["--game"], ["--game", "x", "--apply"], ["--game", "x", "--hltb-id", "1"], ["--game", "x", "--overwrite", "mainHours"], ["--game", "x", "--apply", "--hltb-id", "-1"], ["--game", "x", "--apply", "--hltb-id", "1", "--overwrite", "madeUp"], ["--game", "x", "--game", "y"], ["--game", "x", "--retry-sync", "--apply", "--hltb-id", "1"], ["--game", "x", "--source-url", "https://example.com"]])("rejects invalid or implicit mutation options", (args) => expect(() => parseHltbOptions(args)).toThrow());
});
