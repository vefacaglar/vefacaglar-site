# Architecture

This is an overview of the repository's current design and deployment
configuration. [AGENTS.md](../AGENTS.md) contains coding rules.

```text
Browser -> apps/web (Next.js) -> apps/api (Fastify) -> PostgreSQL
    |                              |                    ^
    |                              -> Meilisearch       |
    -> API job SSE                                      |
                                       apps/worker (Rust)
                                       -> PostgreSQL + Meilisearch
```

| Component | Role |
| --- | --- |
| `apps/web` | Next.js 15 and React 19 site, game/movie library and admin dashboard; Docker standalone deployment |
| `apps/api` | Fastify 5 API, auth, catalog, search reads and incremental writes, and job enqueueing; Docker runs `dist/server.js` |
| `apps/worker` | Rust background jobs; production deployment uses two replicas, with a global limit of two running jobs |
| `packages/db` | Drizzle schema, generated migrations and database tools |
| `packages/ui` | Shared React components, CSS controls and palette tokens |
| PostgreSQL | Source of truth and job queue |
| Meilisearch | Search indexes; see [search contract](search-meilisearch.md) |

The configured Docker deployments target the VPS. The web app talks to the API
rather than directly to the database, search engine or worker. Browsers connect
directly to the API for job SSE streams, with polling as fallback.

## Web

The main site contains the home, about, blog, projects and packages pages. The
library includes `/explore/games`, `/explore/movies` and `/profile/...` with
separate styling. Legacy `/games` and `/movies` paths redirect to `/explore`.
Game and movie catalogs have detail pages; profiles include game and movie
activity. See [game ranking](game-ranking.md), [movie catalog](movies-catalog.md)
and [movie activity](movie-activity.md).

The admin dashboard manages content and jobs. Server components and actions use
the API; authentication supports password and OIDC modes. Shared palette and
controls live in `packages/ui`; app-specific styles use CSS Modules.

## API and data

Feature folders contain TypeBox schemas and handlers, with thin route dispatchers.
Handlers delegate data access to repositories or services, and `tsyringe` supplies
dependencies. Route pre-handlers enforce authorization. Swagger is available at
`/swagger`. The database schema and migrations live in `packages/db`; when an API image is built and API or worker deployment is enabled, CD applies
pending migrations before deployment. Migrations must remain
compatible with releases still running during rollout.

## Search and jobs

Meilisearch serves search with PostgreSQL fallback when it is unavailable or an
index is not ready. The API handles incremental writes; the worker builds and
synchronizes indexes. Generic `search.reindex` and `search.sync` cover games,
facets and posts; `search.movies.sync` owns movie and people indexes. These jobs
share a concurrency key. See [search](search-meilisearch.md) and
[movie search](movie-search.md).

The API enqueues jobs in PostgreSQL and notifies workers; the worker claims jobs,
reports progress, and supports retries and checkpoints where implemented. The
jobs dashboard streams progress directly from the API. The worker also runs
catalog and popularity jobs. For schedules, concurrency and deployment drain
semantics, see [jobs-worker.md](jobs-worker.md).

## Deployment and CI

`.github/workflows/ci-deploy.yml` detects affected components, verifies and builds
images, and applies pending migrations on `main` when an API image is built
and API or worker deployment is enabled. The web,
API and worker are deployed through their respective Docker workflows behind
Caddy. The registered `catalog.games.import` worker job collects the IGDB catalog every six
hours with an atomic database cursor. See the [web](../deploy/web/README.md), [API](../deploy/api/README.md)
and [worker](../deploy/worker/README.md) deployment guides for current rollout,
configuration and recovery details.

The worker is not started by `pnpm dev`. Always check the configured service
URLs before starting it: it can run jobs against the configured database.
