# Current movie popularity

`catalog.movies.popularity.refresh` combines three independently dated public signals. Movie facts, titles and classification continue to come from Wikidata. The source notice on `/explore/movies` links to the providers and shows their actual observation windows. `/credits` carries the approved TMDB logo and required attribution.

## Sources and score

| Source | Observation | Weight | Bounded coverage |
| --- | --- | --- | --- |
| TMDB | `popularity` from the complete daily movie ID export | 63% | Highest 500 eligible IDs |
| Netflix | Latest published global `weekly_views`, merging both Film categories | 27% | All 20 film entries |
| Wikipedia | Human pageviews over three completed UTC days, weighted 1/2/3 | 10% | Up to 48 feed leaders and 16 extra catalog samples |

TMDB publishes its keyless gzip/NDJSON export daily and documents completion by 08:00 UTC. Rows include `id`, `original_title`, `popularity`, `adult` and `video`. The current file also contains nullable video flags. Only explicit `adult=false` and `video=false` rows qualify. The client reads the complete gzip stream and validates every row before accepting the top 500. The ranking uses the exported popularity field. [TMDB export documentation](https://developer.themoviedb.org/docs/daily-id-exports)

Netflix's official `all-weeks-global.tsv` supplies week, category, rank, title, runtime and weekly views. Both `Films (English)` and `Films (Non-English)` must contain all ten distinct ranks for the latest week. Their entries are ranked together by weekly views. The accepted window is the seven days ending on the dataset's week date. [Netflix Top 10](https://www.netflix.com/tudum/top10)

Each feed ranks all its retained observations before identity mapping. Equal values share a rank. Unmatched rows retain their place, so incomplete mapping cannot inflate the remaining films. A provider contributes `weight * 10 / (rank + 9)`. The combined integer score is the rounded sum of contributions multiplied by 1,000,000. Multiple IDs resolving to the same film contribute the strongest rank once per feed. Missing evidence contributes zero with the provider weights fixed. Independent agreement can move a film above a stronger single-feed result.

## Identity and repeatability

TMDB identities use bounded Wikidata `P4947` VALUES queries and the catalog's direct film classes. Conflicting QIDs for one TMDB ID remain unresolved. Positive mappings are cached for 90 days, and explicit misses for one day.

The current Netflix dataset supplies titles and runtime. Its local cache key includes week, category, exact title and runtime. Exact English/default-language Wikidata film labels qualify through corroborating runtime within three minutes. A missing-runtime candidate requires its `P1874` ID to resolve to an official Netflix title page with that exact canonical URL and English title. Multiple qualifying film QIDs are rejected. These title pages are used only to verify identities. The weekly audience measurement always comes from the official TSV.

Verified source identities can create bounded Wikidata film stubs. Normal facts hydration fills them and prioritizes current scored stubs. Existing curated movie facts remain owned by the facts pipeline.

## Durable publication and outages

`movie_audience_sources` stores each provider's last accepted complete snapshot, accepted/attempt timestamps, cooldown, failure counter and error code. `movie_audience_identities` stores mapping evidence and explicit misses. Source expiry is anchored to the observation date, using midnight UTC after three days for TMDB, 21 days for the Netflix week end, and eight days for the Wikipedia window end. Repeated attempts preserve these original dates.

A failed download, partial week, invalid gzip or failed Wikidata request retains that provider's accepted evidence until its expiry. Wikidata failures extend the existing shared facts cooldown with `GREATEST`. Source `Retry-After` waits are respected. A fresh TMDB or Netflix contribution is required before the job collects Wikipedia or publishes a combined ranking. When core audience evidence is unavailable, the job fails while preserving the stored ranking.

The raw Wikipedia collector writes only its observation columns and source state. Combined publication alone owns generic scores, search readiness and ranking generations. The generic columns are `movies.popularity_score`, `popularity_source_date` and `popularity_source_mask`. The mask records TMDB/Netflix/Wikipedia evidence as bits 1/2/4. Public freshness requires a public film carrying a core-source bit, which protects the period while newly discovered core films are still unhydrated.

One `DbProvider` transaction locks the aggregate state and provider snapshots, rejects a concurrently superseded projection, writes the generic scores, captures provider metadata in `movie_popularity_state.id = 'movie-audience-v1'`, and queues affected search revisions. Same-day identical replay is idempotent. The ledger includes old/new generic score rows and legacy Wikipedia observations. Schema-4 Meilisearch documents keep the existing `interestScore` integer contract, so this score change drains a small ledger without rebuilding the whole movie catalog.

At request time all contributing published snapshots must remain current. If one expires before another refresh, the API selects the explicitly labeled recognition fallback until the job republishes the available evidence. `combined_popularity` identifies multiple contributing providers. Single-provider results identify `tmdb_popularity` or `netflix_views`. The public `sources` array includes source date, window start, expiry, source URL and observed/matched counts. SQL and Meilisearch use the same captured generation and score semantics. Typed search keeps its existing relevance rules.

## Runtime and rollout

The job payload is `{}` and its concurrency key remains `catalog.movies.popularity`. Its worker child deadline is eight minutes. HTTP components have total ceilings of 75 seconds for TMDB export selection, 75 seconds for TMDB mapping, 20 seconds for the Netflix TSV, 75 seconds for Netflix identity verification, and 120 seconds for the Wikipedia collector. Requests are serial and paced at least 500 ms apart. Export limits are 96 MiB compressed, 512 MiB decoded and three million rows. Netflix TSV and native title pages are limited to 8 MiB and 2 MiB respectively.

Drizzle-generated migrations `0049` and `0050` add the evidence tables, generic columns and provider metadata. The latter's data step moves only the previous default movie schedules to 08:15 UTC for popularity and 08:30 UTC for the daily dedicated index campaign. Administrator-customized cron expressions and enabled status are preserved. The dedicated movie index keeps `search.movies.index` ownership.

Apply migrations and deploy matching API/worker images before the first combined run. Run popularity, allow normal facts hydration to fill priority stubs, and run `search.movies.sync`. Inspect provider dates, matched counts, leading contribution logs, public browsing and a typed query. The existing schema-4 index is updated incrementally. [Movie search contract](movie-search.md)

## Verified source replay on 2026-11-22

The real clients read the 2026-11-22 TMDB export, the Netflix week ending 2026-11-15 and Wikipedia's 2026-11-19–21 human views. Verified coverage was 438/500 TMDB observations, 11/20 Netflix observations and 48/48 measured Wikipedia candidates. The replay's Wiki candidates used verified provider QIDs plus the current public movie page; production uses its catalog membership query.

| Film | Combined score | TMDB | Netflix | Wikipedia |
| --- | ---: | ---: | ---: | ---: |
| The Odyssey | 644156 | 572727 | 0 | 71429 |
| Iron Man | 630000 | 630000 | 0 | 0 |
| Sunrise on the Reaping | 575524 | 484615 | 0 | 90909 |
| Heart of the Beast | 548810 | 525000 | 0 | 23810 |
| Other Mommy | 468868 | 450000 | 0 | 18868 |
| Spider-Man: Brand New Day | 448571 | 420000 | 0 | 28571 |
| Heartland | 432258 | 175000 | 225000 | 32258 |
| Resident Evil | 415489 | 393750 | 0 | 21739 |

Damping values 8, 10 and 15 were compared. With 8, Iron Man remained first; with 10 and 15, agreement moved The Odyssey first. The chosen 10 kept the stronger head differences while allowing consensus. Relative to the sampled public Wiki list, Om moved to combined position 46, xXx to 83 and XXX: State of the Union to 105. These are replay observations for these source dates.

## Wikipedia component

The component source key remains `enwiki-current-interest-v2`. It validates the latest completed day's entire 1,000-article global feed and maps titles through ordinary anonymous Wikidata lookups. The feed selects up to 48 known-film leaders, followed by up to 16 optional public catalog films released within the past year, ordered by language coverage and ID. Each selected article is then measured over the same three completed days using `all-access/user`. The stored raw Wiki score is `floor((oldest + 2*middle + 3*latest)/6)`.

All accepted films use the same days and denominator. Missing article days remain unobserved, while complete zero windows remain observed zero. Mapping batches contain at most 50 titles with URLs at most 6,500 characters. The collector has a 120-second total deadline, 96-request ceiling, 15-second request timeouts and 2 MiB response limits. Optional coverage has its own 20-second ceiling and is discarded as a group on failure, preserving the measured feed leaders. AQS failures retain accepted raw observations and their dates. [Wikimedia API](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html)
