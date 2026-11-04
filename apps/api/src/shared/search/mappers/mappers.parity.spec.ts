import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { toGameDoc } from "./game.mapper";
import { toPostDoc } from "./post.mapper";
import { toDeveloperDoc, toPublisherDoc, toGenreDoc, toPlatformDoc, toThemeDoc } from "./lookup.mapper";
import { buildAllCollectionSchemas } from "../collections";

/**
 * Golden fixtures shared with the Rust worker (apps/worker/fixtures/search),
 * which reindexes Typesense with its own port of these mappers and schemas.
 * The TS mappers are the source of truth: after changing a mapper or schema,
 * regenerate the expected output with
 *   UPDATE_SEARCH_FIXTURES=1 pnpm --filter api test mappers.parity
 * then update the Rust port until `cargo test` in apps/worker passes again.
 */

const FIXTURES_DIR = resolve(__dirname, "../../../../../worker/fixtures/search");
const MAPPERS_FILE = resolve(FIXTURES_DIR, "mappers.json");
const COLLECTIONS_FILE = resolve(FIXTURES_DIR, "collections.json");
const UPDATE = process.env.UPDATE_SEARCH_FIXTURES === "1";

type Case = { name: string; kind?: string; input: Record<string, unknown>; expected: unknown };
type Fixtures = { games: Case[]; lookups: Case[]; posts: Case[] };

const DATE_FIELDS = ["createdAt", "updatedAt", "publishedAt"];

/** Drizzle returns timestamps as Date objects; fixtures store ISO strings. */
function withDates<T>(input: Record<string, unknown>): T {
  const row: Record<string, unknown> = { ...input };
  for (const field of DATE_FIELDS) {
    if (typeof row[field] === "string") row[field] = new Date(row[field] as string);
  }
  return row as T;
}

/** The exact JSON Typesense receives (undefined fields dropped). */
function asJson(doc: unknown): unknown {
  return JSON.parse(JSON.stringify(doc));
}

const LOOKUP_MAPPERS: Record<string, (row: never) => unknown> = {
  developer: toDeveloperDoc,
  publisher: toPublisherDoc,
  genre: toGenreDoc,
  platform: toPlatformDoc,
  theme: toThemeDoc,
};

function mapCase(group: keyof Fixtures, c: Case): unknown {
  switch (group) {
    case "games":
      return asJson(toGameDoc(withDates(c.input)));
    case "posts":
      return asJson(toPostDoc(withDates(c.input)));
    case "lookups": {
      const mapper = LOOKUP_MAPPERS[c.kind ?? ""];
      if (!mapper) throw new Error(`unknown lookup kind ${c.kind}`);
      return asJson(mapper(withDates<never>(c.input)));
    }
  }
}

const fixtures: Fixtures = JSON.parse(readFileSync(MAPPERS_FILE, "utf8"));
const groups: (keyof Fixtures)[] = ["games", "lookups", "posts"];

if (UPDATE) {
  for (const group of groups) {
    for (const c of fixtures[group]) c.expected = mapCase(group, c);
  }
  writeFileSync(MAPPERS_FILE, JSON.stringify(fixtures, null, 2) + "\n");
  writeFileSync(COLLECTIONS_FILE, JSON.stringify(buildAllCollectionSchemas(), null, 2) + "\n");
}

describe("search mapper parity with the Rust worker", () => {
  for (const group of groups) {
    describe(group, () => {
      for (const c of fixtures[group]) {
        it(c.name, () => {
          expect(c.expected, "fixture has no expected output; regenerate it").not.toBeNull();
          expect(mapCase(group, c)).toEqual(c.expected);
        });
      }
    });
  }

  it("collection schemas", () => {
    const expected = JSON.parse(readFileSync(COLLECTIONS_FILE, "utf8"));
    expect(asJson(buildAllCollectionSchemas())).toEqual(expected);
  });
});
