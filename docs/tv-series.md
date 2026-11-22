# TV series catalog and current popularity

TV series use numeric TVmaze show IDs in URLs and PostgreSQL as the canonical source. Shows, genres, seasons and episodes have separate tables. A season belongs to one show; an episode's composite season/show foreign key prevents cross-show joins. Specials retain their source type and nullable season/episode numbers. A special without a matching season remains available on the show's `orphanSpecials` list. Regular and special episode counts are separate. Counts remain publicly unknown until hierarchy hydration completes. Null ratings mean unavailable; zero remains a real source rating.

Metadata, summaries and ratings come from [TVmaze's public API](https://www.tvmaze.com/api), licensed under [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/). Public cards, show and season pages link to their exact source pages and identify TVmaze ratings. Summaries are converted to plain text; external images are not collected. Derived first/last aired dates only include episodes already aired, while source premiere/end dates remain distinct.

## Registered jobs

Migration `0054_equal_emma_frost` seeds enabled registrations without changing existing custom rows. All schedules are UTC, payloads are `{}`, and each job has its own concurrency key:

| Job | Default cron | Key | Behavior |
| --- | --- | --- | --- |
| `catalog.tv-series.sync` | `0 2 * * *` | `catalog.tv-series` | Daily source updates, resumable full show index, bounded hierarchy hydration |
| `catalog.tv-series.popularity.refresh` | `20 8 * * *` | `catalog.tv-series.popularity` | Complete daily popularity snapshot with verified identities |
| `search.tv-series.sync` | `35 8 * * *` | `search.tv-series.index` | Dedicated, durable `tv_series_en` index publication |

Use Registered jobs → Run now for any of these. For initial population, run popularity first (it queues current leaders even before their index pages arrive), then catalog sync, then TV search sync. Import and index jobs request bounded successor runs while committed work remains. Their Node subprocesses use the existing worker heartbeat, cancellation, retry and drain lifecycle. Source commits wake the enabled TV search registration; popularity also wakes catalog hydration. These requests remain pending while a bounded same-type job is active. Generic game/facet/post reindexing and movie sync do not own the TV index.

The source importer budgets 150 seconds per invocation, up to 40 index pages and 60 successful hierarchy snapshots. It spaces TVmaze requests by at least 550 ms (below the documented rate limit), handles source backoff, and alternates priority work with the oldest queued work. Initial hierarchy coverage is gradual and progresses through continuations; popular leaders receive early priority. This is a full catalog campaign, not a fixed tiny daily sample. Daily `/updates/shows` checks enqueue source changes; a monthly full-index pass finds new and unobserved identities. An index page can be short or empty because source IDs have holes: only HTTP 404 ends the pass. Cursor advancement and page writes commit atomically. Index omissions only request an individual check; a confirmed show endpoint 404 soft-deletes a show. The importer never bulk-removes shows just because a source index omits them.

A hierarchy replaces seasons and episodes together only after a valid show, full seasons and full episodes-with-specials response. The source's previous-episode identity must be present. An empty hierarchy cannot replace previously nonempty episodes. A failed, rate-limited or invalid response preserves the previous snapshot. A request arriving during fetch remains queued after the earlier snapshot commits.

## Popularity measurements

The base is [TMDB's daily TV export](https://developer.themoviedb.org/docs/daily-id-exports), not source ratings. This is TMDB's current daily popularity snapshot, **not** a claim of pure daily viewing or trending: TMDB's popularity definition also incorporates historical votes. The whole gzip/NDJSON file is validated through end-of-file before publication. A missing today's export can fall back to either of the previous two dates, with actual source date and expiry retained.

Exact Wikidata P8600 (TVmaze) and P4983 (TMDB TV series) relationships map source identities. Numeric IDs, bidirectional collisions and ambiguous enwiki articles are checked. Malformed external identifiers are excluded; titles alone never match identities. The map refreshes weekly. No provider account is required for these bulk data endpoints.

Seven completed UTC days of [Wikimedia daily Top1000 pageviews](https://wikimedia.org/api/rest_v1/) add a bounded, positive corroborating bonus through exact English Wikipedia sitelinks. The importer makes one bulk request per day, never hundreds of per-article calls. This signal covers only articles appearing in daily Top1000; absence does not reduce the TMDB score. Score = `log1p(TMDB popularity) + min(2, log1p(observed seven-day top-page views)/10)`. If any day fails, the partial Wikipedia window is discarded and the complete TMDB-only snapshot is labeled accordingly. No Wikipedia/multisource claim is attached to that fallback. A failed main export or identity refresh retains the last publication. Expired source metadata yields alphabetical ordering, never stale ranking labeled current.

A real source pilot on 2026-11-22 found 237,318 TMDB TV rows, 36,365 verified TVmaze/TMDB identities (26,553 with enwiki articles), 36,316 matched scores and 66 exact identities with recent Top1000 observations. These are observed source coverage, not a promise that every title has a popularity measurement. A page-zero local catalog matched 236 of its 240 shows. Under the Dome had 3 seasons, 39 regular episodes and 1 special; The Simpsons had 38 seasons, 811 regular episodes and 3 specials; Doctor Who (TVmaze 210) had 13 seasons, 153 regular episodes and 101 specials.

## Search publication and recovery

The dedicated `tv_series_en` index contains `kind=series` documents keyed by positive TVmaze IDs. A reserved `id=0,kind=metadata` marker records a build token; public readers always filter it out. Each build scans PostgreSQL by stable ID into a staging index and applies revisioned changes, including deletions. Cursor writes follow successful Meilisearch tasks. Dirty acknowledgement includes the captured revision so concurrent changes survive. No partially built index is swapped live.

The database records the pending generation and swap phase before the external swap. On restart, the worker waits for pending swap tasks and compares the live marker to the durable token. An already completed swap is finalized without swapping the old index back. Public search checks schema version, ready phase, ranking readiness and exact published popularity generation before and after hydration; otherwise PostgreSQL supplies the results. Source updates during publication force another build. Failed provider/index tasks retain the prior live index and canonical rows. Staging indexes use the `tv_series_en__` prefix; these jobs cannot modify game/movie indexes.

## Verification

API handler specs mock providers/repositories. Separate opt-in integration checks exercise real writes and Meilisearch, with no provider network calls:

```sh
TV_TEST_DATABASE_URL=postgresql://test@127.0.0.1:5432/tv_integration \
TV_TEST_MEILISEARCH_URL=http://127.0.0.1:7700 \
TV_TEST_MEILISEARCH_API_KEY=local-test-key \
pnpm --filter api exec ts-node --transpile-only src/scripts/check-tv-integration.ts
```

Use a disposable, migrated database with an empty TV catalog and a disposable loopback search server: the check writes TV fixtures and replaces `tv_series_en`. CI runs it after generated migrations against PostgreSQL 17 and Meilisearch 1.56.2. Local source/SQL pilots used temporary PostgreSQL plus native Meilisearch 1.15.2 on Apple Silicon (the current release has no native Apple Silicon asset). The integration covers cursor rollback, null/zero ratings, orphan specials, hierarchy retention, request and dirty revision races, actual index publication, swap-crash recovery and deletions.
