/** Opt-in integration check: only a disposable loopback database and Meili. */
import "reflect-metadata";
import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { schema } from "@vefacaglar/db";
import { DbProvider } from "../db.provider";
import { DrizzleTvSourceRepository } from "../modules/tv-series/import/tv-source.repository";
import { parseTvShow, parseTvHierarchy, parseTvPage } from "../modules/tv-series/import/tvmaze-normalizer";
import { DrizzleTvPopularityRepository } from "../modules/tv-series/popularity/tv-popularity.repository";
import { DrizzleTvIndexRepository } from "../modules/tv-series/search-sync/tv-index.repository";
import { TvIndexClient } from "../modules/tv-series/search-sync/tv-index.client";
import { SyncTvIndexHandler } from "../modules/tv-series/search-sync/sync.handler";
import { dirtyTvSearch } from "../modules/tv-series/tv-dirty";
async function main() {
  const connection = process.env.TV_TEST_DATABASE_URL;
  if (!connection || !process.env.TV_TEST_MEILISEARCH_URL || !process.env.TV_TEST_MEILISEARCH_API_KEY) throw new Error("TV_TEST_DATABASE_URL and TV_TEST_MEILISEARCH_URL/API_KEY are required");
  if (!["localhost", "127.0.0.1"].includes(new URL(connection).hostname) || !/[\w-]*(test|verify|integration)[\w-]*$/.test(new URL(connection).pathname)) throw new Error("Use an isolated loopback test database");
  if (!["localhost", "127.0.0.1"].includes(new URL(process.env.TV_TEST_MEILISEARCH_URL).hostname)) throw new Error("Use a disposable loopback Meilisearch server");
  process.env.MEILISEARCH_URL = process.env.TV_TEST_MEILISEARCH_URL;
  process.env.MEILISEARCH_API_KEY = process.env.TV_TEST_MEILISEARCH_API_KEY;
  const client = postgres(connection, { max: 4 });
  const db = drizzle(client, { schema }), provider = new DbProvider(db);
  try {
    assert.equal((await db.execute(sql`select count(*)::int n from tv_series`))[0].n, 0, "TV integration requires an empty TV catalog");
    const repository = new DrizzleTvSourceRepository(provider), index = new DrizzleTvIndexRepository(provider), search = new TvIndexClient();
    const show = parseTvShow({ id: 1, name: "Fixture series", genres: ["Drama"], summary: "<p>A &amp; B</p>", rating: { average: 0 }, url: "https://www.tvmaze.com/shows/1/fixture", updated: 1700000000 });
    assert.equal(show.rating, 0); assert.equal(show.summary, "A & B");
    assert.equal(parseTvPage([], 1).length, 0);
    await repository.indexPage(0, [show], new Date());
    assert.equal((await repository.state(new Date())).nextPage, 1);
    await assert.rejects(() => repository.indexPage(0, [show], new Date()), /cursor_changed/);
    await assert.rejects(() => repository.indexPage(1, [{ ...show, id: 251, name: null as unknown as string }], new Date()));
    assert.equal((await repository.state(new Date())).nextPage, 1);
    assert.equal((await db.execute(sql`select id from tv_series where id=251`)).length, 0);
    const hierarchy = parseTvHierarchy(show, [{ id: 10, number: 1, url: "https://www.tvmaze.com/seasons/10/fixture" }], [
      { id: 100, season: 1, number: 1, name: null, type: "regular", rating: { average: 0 }, url: "https://www.tvmaze.com/episodes/100/fixture" },
      { id: 101, season: 9, number: null, type: "significant_special", rating: { average: null }, url: "https://www.tvmaze.com/episodes/101/fixture" },
    ]);
    await repository.hierarchy({ seriesId: 1, requestedAt: new Date() }, hierarchy, new Date());
    const [counts] = await db.execute(sql`select episode_count,special_count from tv_series where id=1`);
    assert.equal(counts.episode_count, 1); assert.equal(counts.special_count, 1);
    assert.equal((await db.execute(sql`select season_id from tv_episodes where id=101`))[0].season_id, null);
    await assert.rejects(() => repository.hierarchy({ seriesId: 1, requestedAt: new Date() }, { ...hierarchy, episodes: [] }, new Date()), /empty_hierarchy_regression/);
    assert.equal((await db.execute(sql`select count(*)::int n from tv_episodes`))[0].n, 2);
    await repository.updates([{ id: 1, updatedAt: new Date() }], new Date());
    await repository.hierarchy({ seriesId: 1, requestedAt: new Date(Date.now() - 60000) }, hierarchy, new Date());
    assert.equal((await db.execute(sql`select count(*)::int n from tv_refresh_queue where series_id=1`))[0].n, 1);
    // Hierarchy refresh and confirmed-404 acknowledgements use the same
    // lossless timestamp contract as cast, including sub-millisecond races.
    const stamp="2026-11-22 21:00:00.123456+00";
    await db.execute(sql`update tv_refresh_queue set requested_at=${stamp}::timestamptz,due_at=now()-interval '1 second' where series_id=1`);
    const micro=(await repository.candidates(10000,new Date())).find(row=>row.seriesId===1)!;
    assert.equal(typeof micro.requestedAt,"string");
    assert.ok(String(micro.requestedAt).includes(".123456"));
    await db.execute(sql`update tv_refresh_queue set requested_at=requested_at+interval '1 microsecond' where series_id=1`);
    await repository.hierarchy(micro,hierarchy,new Date());
    assert.equal((await db.execute(sql`select count(*)::int n from tv_refresh_queue where series_id=1`))[0].n,1);
    const nextMicro=(await repository.candidates(10000,new Date())).find(row=>row.seriesId===1)!;
    assert.ok(String(nextMicro.requestedAt).includes(".123457"));
    await repository.hierarchy(nextMicro,hierarchy,new Date());
    assert.ok(!(await repository.candidates(10000,new Date())).some(row=>row.seriesId===1));
    await db.execute(sql`insert into tv_refresh_queue(series_id,requested_at,due_at)values(1,${stamp}::timestamptz,now()-interval '1 second')`);
    const missing=(await repository.candidates(10000,new Date())).find(row=>row.seriesId===1)!;
    await repository.missing(missing,new Date());
    assert.equal((await db.execute(sql`select count(*)::int n from tv_refresh_queue where series_id=1`))[0].n,0);
    await repository.hierarchy({seriesId:1,requestedAt:new Date()},hierarchy,new Date());
    const otherShow = { ...show, id: 2, name: "Other series", sourceUrl: "https://www.tvmaze.com/shows/2/other" };
    await assert.rejects(() => repository.hierarchy({ seriesId: 2, requestedAt: new Date() }, {
      show: otherShow, seasons: [{ ...hierarchy.seasons[0], id: 20, seriesId: 2 }],
      episodes: [{ ...hierarchy.episodes[0], seriesId: 2, seasonId: 20 }],
    }, new Date()), /episode_identity_collision/);
    assert.equal((await db.execute(sql`select series_id from tv_episodes where id=100`))[0].series_id, 1);
    const at = new Date(), day = at.toISOString().slice(0, 10);
    const pop = new DrizzleTvPopularityRepository(provider);
    await pop.publish({ scores: [{ seriesId: 1, score: 42 }], sources: [{ provider: "tmdb", sourceDate: day, windowStart: day, expiresAt: new Date(at.getTime() + 86400000).toISOString(), sourceUrl: "https://files.tmdb.org" }], providerRows: 1, mapped: 1, wikiMatches: 0 }, at);
    const handler = new SyncTvIndexHandler(search, index);
    await handler.handle(); assert.equal((await index.state()).rankingReady, true);
    const result = await fetch(process.env.MEILISEARCH_URL + "/indexes/tv_series_en/search", { method: "POST", headers: { Authorization: `Bearer ${process.env.MEILISEARCH_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ q: "Fixture", filter: 'kind = "series"', page: 1, hitsPerPage: 10 }) }).then((response) => response.json()) as any;
    assert.deepEqual(result.hits.map((row: any) => row.id), [1]);
    await provider.transaction(async () => dirtyTvSearch(provider.client, [1]));
    const captured = await index.dirty(1000);
    await provider.transaction(async () => dirtyTvSearch(provider.client, [1]));
    await index.acknowledge(captured); assert.equal((await index.dirty(1000)).length, 1);
    // A real successful swap whose SQL finalize was interrupted must not swap back.
    const build = await index.start();
    await search.configure(build.buildIndex!);
    await search.documents(build.buildIndex!, await index.documents([1]));
    await index.advance(build.buildIndex!, 1, true);
    await index.acknowledge(await index.dirty(1000));
    assert.ok(await index.prepareSwap(build.buildIndex!));
    await search.documents(build.buildIndex!, [{ id: 0, kind: "metadata", buildToken: build.buildToken }]);
    await search.swap(build.buildIndex!);
    const marker = await search.marker("tv_series_en");
    await handler.handle();
    assert.equal(await search.marker("tv_series_en"), marker);
    assert.equal((await index.state()).rankingReady, true);
    // A canonical deletion disappears from search only on a complete new publication.
    await repository.missing({ seriesId: 1, requestedAt: new Date() }, new Date());
    await handler.handle();
    const after = await fetch(process.env.MEILISEARCH_URL + "/indexes/tv_series_en/search", { method: "POST", headers: { Authorization: `Bearer ${process.env.MEILISEARCH_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ q: "Fixture", filter: 'kind = "series"', page: 1, hitsPerPage: 10 }) }).then((response) => response.json()) as any;
    assert.equal(after.totalHits, 0);
    console.log("TV integration passed: lossless microsecond hierarchy/404 ACK and concurrent wake retention, raw-page cursor rollback, null/zero ratings, orphan specials, atomic hierarchy retention, concurrent refresh/dirty preservation, real Meili publication, swap crash recovery and deletion");
  } finally { await client.end({ timeout: 3 }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
