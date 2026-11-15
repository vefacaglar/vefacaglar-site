import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { DISCOVERY_QUERY } from "./wikidata-discovery.client";
import { FILM_CLASS_QIDS } from "./wikidata-discovery.types";

describe("film discovery query", () => {
  it("selects distinct films directly classified as every listed film class", () => {
    expect(DISCOVERY_QUERY).toContain("SELECT DISTINCT ?film");
    expect(DISCOVERY_QUERY).toContain("wdt:P31 ?class");
    expect(DISCOVERY_QUERY).not.toContain("P279");
    for (const qid of FILM_CLASS_QIDS) expect(DISCOVERY_QUERY).toContain(`wd:${qid}`);
    expect(FILM_CLASS_QIDS).toContain("Q202866");
  });
});
