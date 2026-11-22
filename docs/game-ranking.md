# Game catalog ranking

The default public game list favors currently active campaign and solo games. The ranking version is `current-campaign-interest-v2`, stored on `games.popularity_version` and reported by the registered `catalog.popularity.refresh` job.

## Current evidence

The daily refresh reads fresh IGDB Visits, Playing additions, Played additions, and Steam 24-hour peak activity. Each measurement is normalized against its own global provider peak with a square root. The gaming blend gives these signals 45%, 20%, 20%, and 15%, respectively. Fixed weights keep missing sources from inflating the contribution of a single measurement. Accepted observations have a `calculated_at` within 72 hours, with five minutes of future clock tolerance.

The bounded current-interest cohort takes the top 200 Visits games, top 100 Playing games, top 100 Played games, and top 50 Steam games, interleaved deterministically across sources. At most 450 explicit identities are discovered or hydrated through the existing IGDB client. Discovery uses the canonical importer, preserving existing content and keeping parent-linked remakes eligible.

For this cohort, official IGDB website links identify English Wikipedia articles, including mobile links. The job measures 35 complete UTC days of human pageviews. The most recent seven days give current audience; the preceding 28 days provide a weekly baseline. A valid window requires every date, the requested article identity, and `user` agent data. Full windows are cached durably per game and article. A same-day retry reuses them. Fresh cached windows remain usable for up to 72 hours after their actual source day through a provider outage.

## Score

Every game starts with the same `0.35 × gaming blend` component. A verified Wikipedia window can add two components.

- Up to 0.35 from current audience, saturating as `weekly views / (weekly views + 5,000)`.
- Up to 0.30 from positive incremental attention above the four-week baseline. Growth is normalized logarithmically, shrunk against at least 1,000 weekly views or 10% of normal audience, and corroborated by current gaming Visits plus Playing or Steam activity.

A strong current audience can therefore keep a post-launch plateau competitive while a genuine resurgence adds material interest. Small fluctuations on a tiny baseline contribute little. A game with no valid current IGDB observations retains a null score. Measured zero activity stays zero. Visits-only evidence keeps a positive score at half confidence, preserving coverage for platforms whose participation observations are unavailable.

## Campaign and format affinity

Exact IGDB taxonomy concepts and game modes provide format evidence. The ranking applies bounded multipliers.

- Campaign evidence or an independently measured solo format receives 1.00.
- Unknown format coverage receives 0.85.
- Hybrid campaign/ongoing formats receive 0.60.
- Measured ongoing formats receive 0.35.

Ongoing evidence includes MMO and battle-royale modes, explicit never-ending or esports/ranked-play taxonomy, and the combined user-generated-content plus game-creator tags with multiplayer support. An incidental creation tag, mod support, or sandbox theme alone does not classify a game as ongoing. Campaign evidence uses exact campaign/story-rich/linear-play/endings taxonomy or storyline evidence with single-player support. Single-player-only mode is recognized independently of missing narrative fields. Every measured format retains a positive score, allowing strong current demand to overcome affinity.

Verified single-player support retains the separate, gentle 5% relative preference. The final score is normalized to 0–1. Review totals, game length, release age, private activity, titles, identifiers, and franchise quotas do not enter the algorithm. IGDB completion-time observations were evaluated and omitted because sparse submissions and outliers did not reliably establish campaign format.

## Bounded operation and fallback

The refresh makes one bounded ranking-metadata request and at most 250 distinct Wikipedia requests, spaced by at least 500 milliseconds, under a four-minute deadline. Individual requests have an eight-second timeout and a 128 KiB response limit. Article requests are shared across identities. A provider cooldown is stored durably, including `Retry-After`. Missing or incomplete windows retain unknown coverage. They never replace a cached observation with zero. A failed provider retains fresh cached data, then falls back to the same gaming component as the cache expires. Database failures fail the job.

Each final score is dated with its oldest contributing source observation in `popularity_updated_at`. Public SQL expires it after 72 hours, including during a job outage. The canonical `popularity_score` drives SQL browsing, company pages, and game search documents. Default browsing orders it descending with deterministic title/UUID ties. Typed searches retain title relevance and refresh card fields from SQL. Strict CLI runs reindex all considered games so retries repair an earlier publication failure.

Apply generated migration `0051_clever_the_watchers.sql` before deploying the API and worker. It adds the version column and bounded Wikipedia cache/cooldown tables. The worker's existing `catalog.popularity.refresh` registration runs this pipeline. Its logs report version, measured audience coverage, provider request count, and search synchronization counts.
