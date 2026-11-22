# Meilisearch search contract

Meilisearch (`getmeili/meilisearch:v1.56.2`) serves public and dashboard
search. PostgreSQL stays the source of truth: every index can be rebuilt from
it, and the API falls back to SQL whenever an index is missing, not ready,
slow or failing.

## Connection

| Variable | Used by | Value |
| --- | --- | --- |
| `MEILISEARCH_URL` | API, worker | `http://meilisearch:7700` on the shared Docker network (`${LOGS_PROXY_NETWORK:-databases_default}`, alias `meilisearch`) |
| `MEILISEARCH_API_KEY` | API, worker | See [API keys](#api-keys) |

Both are GitHub secrets in the `api-production` environment (the one that holds
`DATABASE_URL`). `ci-deploy.yml` passes them to the API and worker deploy jobs;
the worker job prefers an optional `MEILISEARCH_WORKER_API_KEY` secret and falls
back to `MEILISEARCH_API_KEY`. Without a URL the API serves search from
PostgreSQL and the worker's search jobs fail permanently with a clear error.
The worker treats a URL with credentials (`http://user:pass@host`) as missing:
the key belongs in `MEILISEARCH_API_KEY`.

## Indexes

Every index uses the stable uid below and primary key `id`. Readers and writers
only ever address the stable uid; there are no aliases.

| Uid | Owner job | Documents |
| --- | --- | --- |
| `games_en` | `search.reindex` / `search.sync` | Games (`GameDoc`) |
| `developers_en`, `publishers_en`, `genres_en`, `platforms_en`, `themes_en` | `search.reindex` / `search.sync` | Lookups (`LookupDoc`) |
| `posts_en` | `search.reindex` / `search.sync` | Published posts (`PostDoc`) |
| `movies_en` | `search.movies.sync` | Public films |
| `movie_people_en` | `search.movies.sync` (people step) | Searchable people |

Document fields are unchanged from the Typesense documents. Games, lookups and
posts come from `apps/worker/src/jobs/search/mappers.rs`, which is held to the
API's TypeScript mappers by the golden fixtures in
`apps/worker/fixtures/search/mappers.json`. Movie documents are
`id, title, originalTitle, personQids, interestScore, recognitionCount,
interestRecognitionRank, titleSort, tieBreakId` (`movie_search/source.rs`).
People documents are `id, name, publicCreditCount, nameSort`
(`movie_search/people.rs`).

## Settings

Settings live in versioned JSON files, one per index:
`apps/worker/src/jobs/search/meili/<uid>.json`. Only the keys in a file are
managed; everything else stays at the Meilisearch default (`searchCutoffMs`
included). The worker compares a live index with its file by content, ignoring
the order of `filterableAttributes` and `sortableAttributes` (Meilisearch stores
them sorted). A missing index or any difference triggers a rebuild, so changing
a file is the whole migration: deploy it and the next sync rebuilds that index.

| Uid | Searchable | Filterable | Sortable | Ranking rules | `maxTotalHits` |
| --- | --- | --- | --- | --- | --- |
| `games_en` | title, originalTitle, slug, developerNames, publisherNames, genreNames, platformNames, themeNames, description | id, slug, developerIds, publisherIds, genreIds, platformIds, themeIds | popularityScore, releaseTimestamp, createdAt | words, typo, proximity, attribute, sort, exactness, popularityScore:desc | 500000 |
| lookups (5) | name, slug | id, slug | name, createdAt | default | 200000 |
| `posts_en` | title, excerpt, content, seoTitle, seoDescription | id, slug | publishedAt, createdAt | default | 100000 |
| `movies_en` | title, originalTitle | personQids | interestRecognitionRank, interestScore, recognitionCount, titleSort, tieBreakId | words, typo, proximity, wordPosition, sort | 1000000 |
| `movie_people_en` | name | none | publicCreditCount, nameSort | words, typo, proximity, attribute, exactness, publicCreditCount:desc, nameSort:asc | 1000000 |

`maxTotalHits` is above the largest expected size of each index, so counts and
deep pages stay exact. The API reads it (`GET /indexes/{uid}/settings/pagination`)
when a page comes back short.

**Movie ranking.** `movies_en` drops `attribute`/`attributeRank`, so `title`
and `originalTitle` weigh the same, as they did in Typesense. It also drops
`exactness`, matching Typesense's disabled exact-match priority: an obscure film
named exactly "Star Wars" must not outrank the main films. `wordPosition` keeps
titles that begin with the query first. `sort` comes after the relevance rules,
so typed queries rank by relevance and use the API's sort only to break ties,
while a placeholder (browse) query is a pure sort.

**Search-box suggestion groups.** `/api/movies/suggest` (people, movies) and
`/api/games/search/suggest` (developers, publishers, games) return an `order`
array, best-matching group first, and the web dropdowns render and navigate in
that order. Raw `_rankingScore` is not compared across indexes: the ranking
rules differ, so "megan" scores 1.0 on the film "Megan Leavey" and 0.985 on
"Megan Fox", and "bethesda" 0.998 on "Bethesda Pinball" and 0.992 on "Bethesda
Softworks" (local v1.56.2 with these settings). Instead
`apps/api/src/shared/search/suggestion-group-order.ts` scores each group by its
best suggestion's text: exact text, then every query word a whole word, then
word prefixes, then anything else (typos, split words); then the share of the
text's words matched; then whether the text starts with the query. Ties put
name groups (people, companies) before title groups. The same rule applies when
PostgreSQL answers.

## Rebuilds and swaps

A rebuild never touches the live index until the replacement is complete:

1. Create `<uid>__build_<suffix>` with the settings file and load it from
   PostgreSQL.
2. Swap it with `<uid>` in one `POST /swap-indexes` call. If `<uid>` does not
   exist yet (first build), the build is renamed into it (`rename: true`).
3. Delete the build index, which now holds the old documents.

`search.reindex` builds all seven games-family indexes (suffix: the run's UTC
timestamp, `YYYYMMDDHHMMSS`) and swaps them in a single atomic call. Its
checkpoint resumes into the same build indexes; a build whose settings no longer
match is recreated. A run resumed after the swap only cleans up: the swap is
detected from Meilisearch's task history (`GET /tasks?types=indexSwap`), never
repeated. Cancelling deletes the half-built indexes; a failure keeps them for the
retry (until the next plain `search.sync`, which deletes leftover build indexes;
a retry then recreates them).

API writes made during a games-family rebuild go to the old index and are
swapped out. Right after the swap (and again when a run resumes after it),
`search.reindex` re-upserts every row changed since the run started, minus a
five-minute margin, into the stable indexes. "Changed" means `created_at`,
`updated_at` (games also `popularity_updated_at`, or a linked lookup's
`updated_at`; posts also `published_at`) at or after that time. The run start
is stored in the checkpoint (`startedAt`; older checkpoints fall back to the
run suffix). Rows deleted or unpublished during the rebuild are left as
orphans until the next `search.sync` deletes them.

`search.movies.sync` builds `movies_en__build_<id>` and
`movie_people_en__build_<id>`. Before swapping movies it commits phase `swap`
in `movie_search_state`, so a crash between the swap and the database update
resumes by finishing the swap (or only recording it) instead of rescanning.
If neither the swap happened nor the build index still exists, the run starts a
fresh build instead. Every run also deletes leftover movie build indexes, so a
failed delete after a swap is retried.

## Readiness signals for the API

| Index | Ready when |
| --- | --- |
| `movies_en` | `movie_search_state`: `schema_version = 3`, `bootstrap_phase = 'ready'`, `ranking_ready`, `active_collection = 'movies_en'` |
| `movie_people_en` | `movie_people_search_state`: `schema_version = 2`, `active_collection = 'movie_people_en'` |
| games family | the index exists |

Every movie swap sets `active_collection = 'movies_en'`, `phase = 'ready'`,
`ranking_ready = false` and increments `ranking_generation`. The run then drains
pending revisions and publishes, which sets `ranking_ready = true`. Readers
compare `ranking_generation` and `published_source_date` before and after card
hydration, so a swap during a request makes it fall back to SQL. The steady
publish does not bump the generation: it repeats every run, and readiness
already gates the rebuild window. `previous_collection` of the people state is
always `NULL` (the stable uid makes a grace generation unnecessary).

The API only writes into indexes that already exist and never creates one. Old
API releases see `movies_en` as a foreign collection name and use SQL.

## Bootstrap and healing

Migration `0044_schedule_search_sync` schedules `search.sync` hourly
(`17 * * * *`) and makes it due immediately. `search.sync` first checks every
games-family index: when one is missing or its settings differ from the file,
it logs the reason and runs a full rebuild instead (resumable with the
`search.reindex` checkpoint). Otherwise it deletes leftover build indexes,
restores missing documents and deletes orphans (documents without a source
row). The indexed ids are read before the source ids, so a document created
while the sync runs is never taken for an orphan. So the first sync after the
cutover builds everything, and later syncs heal drift. `search.movies.sync` builds `movies_en` and `movie_people_en`
on its own schedule (`*/5 * * * *`), enabled by default via migration `0046_schedule_popularity_jobs` (unless disabled with a non-default schedule).


## API keys

The master key stays on the server. Create keys with `POST /keys` on `*`
(build uids are generated, so the worker cannot be limited to fixed uids).

| Key | Actions |
| --- | --- |
| Worker | `indexes.create`, `indexes.get`, `indexes.delete`, `indexes.swap`, `settings.get`, `settings.update`, `documents.add`, `documents.get`, `documents.delete`, `tasks.get` |
| API | `search`, `indexes.get`, `settings.get`, `documents.add`, `documents.delete`, `tasks.get` |

One key with the union of both lists works (set only `MEILISEARCH_API_KEY`).
Separate keys are preferred: with `MEILISEARCH_WORKER_API_KEY` for the worker,
the API key lacks `indexes.create`, and Meilisearch then refuses to auto-create
a missing index from a document write (verified on v1.56.2; an admin key would
create it with default settings). The worker's child `refresh-popularity.js`
runs with the worker's key.

## Local and test servers

```sh
docker run -d -p 7700:7700 -e MEILI_MASTER_KEY=dev-master-key getmeili/meilisearch:v1.56.2
```

`apps/worker/tests/meilisearch_integration.rs` runs build, swap, sync and the
movie/people jobs against a real server when `WORKER_TEST_MEILISEARCH_URL`
(and `WORKER_TEST_MEILISEARCH_API_KEY`) are set, plus `WORKER_TEST_DATABASE_URL`
for the PostgreSQL-backed part. It deletes the stable indexes: point it only at
a throwaway server. CI runs it against a service container.
