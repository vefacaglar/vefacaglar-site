# Architecture

How the pieces of this monorepo fit together. Coding rules live in
[AGENTS.md](../AGENTS.md); the job system is specified in
[jobs-worker.md](jobs-worker.md).

## Overview

```txt
                 ┌──────────────────────────────┐
  browser ──────▶│ apps/web  (Next.js, Vercel)  │
                 │ site · library · dashboard   │
                 └──────────────┬───────────────┘
                                │ HTTP (server components / actions / route handlers)
                 ┌──────────────▼───────────────┐        ┌────────────┐
                 │ apps/api  (Fastify, VPS)     │───────▶│ Typesense  │
                 │ api2.vefacaglar.com          │◀── ─ ─ │ (search)   │
                 └───┬──────────────────────────┘        └─────▲──────┘
                     │ Drizzle                                 │ bulk import,
                     ▼                                         │ alias swap
                ┌──────────┐                     ┌─────────────┴──────────┐
                │ Postgres │                     │ apps/worker (Rust, VPS)│
                │ data +   │                     │ background jobs        │
                │ job queue│◀────────────────────│ LISTEN / poll / claim  │
                └──────────┘                     └────────────────────────┘
```

| Part | Tech | Runs on | Purpose |
|---|---|---|---|
| `apps/web` | Next.js 15, React 19, CSS Modules | Vercel (free Hobby tier) | Personal site, game library (`/games`, `/movies`, `/profile`), admin dashboard |
| `apps/api` | Fastify 5, TypeBox, tsyringe, Drizzle | Docker on the VPS (`dist/server.js`); Vercel entry `dist/app.js` kept | REST API, auth, catalog, search reads + incremental writes, job enqueueing |
| `apps/worker` | Rust (tokio, sqlx, reqwest) | Docker on the same VPS as the API, single replica | Long-running jobs: full search reindex, index sync |
| `packages/db` | Drizzle ORM + Drizzle Kit | — | Schema, generated migrations, seeds |
| `packages/shared` | TypeScript | — | Shared helpers |
| Postgres | — | managed / VPS | Source of truth and the only job queue |
| Typesense | — | VPS | Search (English-only collections behind aliases) |

**Boundary rule:** the web app talks only to the API. It never connects to
Postgres, Typesense or the worker. The API and the worker share one VPS.
Because the web app runs on Vercel's free tier, long-lived requests (streams,
long polling) should not be held open inside Vercel functions.

## Web (`apps/web`)

The web app has two products with separate looks:

- **Main site**: home, about, blog, projects, packages. Lowercase, monospaced
  (Fira Code) on the root palette from `globals.css`.
- **Library**: `/games`, `/movies`, `/profile/...`. It has its own brand
  ("Vefa Library"), its own header and footer (`components/library/LibraryShell`),
  its own SEO and Open Graph images (`lib/librarySeo.ts`) and never links back to
  the main site. A graphite palette and the Geist font are scoped to library pages
  in `globals.css` (`[data-library]`). Text is sentence case.
  - `/games`: catalog browse/search sorted by popularity; game detail pages with a
    blurred cover backdrop; signed-in users log games (status, rating, playtime).
  - `/profile/[username]`: overview, `/games` (status tabs, sort, grid/list view,
    platform chart), `/movies` (placeholder). Profiles are private by default;
    the owner makes theirs public in `/profile/settings`.
  - `/movies`: placeholder for a later phase.
- **Dashboard** (`/dashboard`, admin only): content editing (posts, pages,
  projects, packages, games) and the jobs screen (`/dashboard/jobs`).

Conventions: server components fetch the API through `lib/httpClient.ts`
(`API_URL`); mutations go through server actions; styles are CSS Modules with
palette variables only, no inline styles, square corners. Auth is a
`session_token` cookie (password login or OIDC, see `lib/oidc.ts`); the session
is resolved with `lib/session.ts` (`GET /api/auth/me`).

## API (`apps/api`)

- **Feature folders**: `src/modules/<module>/<feature>/` with `*.schema.ts`
  (TypeBox) and `*.handler.ts`; thin `*.routes.ts`; public and dashboard
  endpoints are always separate features.
- **Data access**: handlers never touch Drizzle. Repositories (one domain, may
  span several tables) and services (several sources) inject `DbProvider`;
  transactions propagate through `AsyncLocalStorage`.
- **DI**: `tsyringe`, everything registered in `src/container.ts`.
- **Auth**: `app.requireAdmin` / `app.tryAuth` pre-handlers in routes only.
- **Errors and i18n**: `HttpError` subclasses with translation keys; DB content
  translations come from the `localizations` table (skipped for English).
- **Docs**: Swagger at `/swagger`.

Modules: `auth`, `authors`, `catalog` (games, developers, publishers, genres,
platforms, themes, IGDB import, popularity), `games` (public catalog, logs,
library, public profiles), `jobs`, `localizations`, `packages`, `pages`, `posts`,
`projects`, `uploads`.

### Game library data

- `user_games` holds one log per user and game (status, rating /100, playtime,
  platform, dates).
- `user_game_playtime_entries` is an audit trail: when playtime goes up
  (5 h → 8 h) the increase (3 h) is stored with the previous and new values.
  Decreases are not recorded.
- Library endpoints (`/api/games/me/library`,
  `/api/games/users/:username/library`) return a summary (counts, hours,
  average rating, platform distribution) and per-game rows (completion date,
  last activity, platform, critic score). Private profiles answer 401 for
  visitors that are not signed in and 403 for signed-in non-owners.

### Popularity

Games carry a `popularityScore` built from IGDB popularity signals (Played,
Want to Play, Steam total reviews) and the IGDB rating count. Raw signals are
stored in `game_popularity_signals`; the score is a weighted mix of
log-percentiles. It is refreshed by `pnpm --filter api catalog:popularity` or
`POST /api/catalog/popularity/refresh` (admin). Browse sorts by popularity, then
release date.

## Search

- **Read/write split**: `ISearchReader` for queries, `ISearchIndexWriter` for
  incremental per-document writes triggered by domain events
  (`shared/events`, in-process bus). Handlers never write to Typesense directly.
- **Resilience**: queries fall back to Postgres when Typesense times out or is
  unavailable. The API process waits 30 seconds before trying Typesense again.
- **Collections**: English only — `games_en`, `developers_en`, `publishers_en`,
  `genres_en`, `platforms_en`, `themes_en`, `posts_en`. Each name is an alias
  that points at a timestamped physical collection (`games_en__20261104120000`).
  The API only bootstraps missing collections/aliases on startup
  (`ensureCollections`, server entry only).
- **Bulk work belongs to the worker**: full rebuilds and gap filling are jobs
  (see below). The Rust mappers are kept identical to the TypeScript ones by
  shared golden fixtures tested on both sides.

## Background jobs

A small Hangfire-style system with Postgres as the only queue.

```txt
dashboard ──▶ api: INSERT job + pg_notify('jobs') ──▶ Postgres ◀── worker: LISTEN + 5 s poll,
                                                                  claim (FOR UPDATE SKIP LOCKED),
dashboard ◀── api SSE stream ◀── LISTEN job_events ◀──────────────  progress / logs / checkpoint
```

- **Tables**: `jobs`, `job_logs`, `recurring_jobs` (registered jobs), `workers`.
- **Worker**: heartbeats, a reaper that requeues jobs from dead workers,
  per-batch checkpoints (resume after crash, deploy or retry), cancel between
  batches, retries with backoff, graceful shutdown that pauses and requeues.
- **Registered jobs** (no cron, started from the dashboard):
  - `search.reindex`: full rebuild. Builds new timestamped physical
    collections, loads all data, then switches every alias at once and deletes
    the old collections. Search keeps serving the old data until the switch.
  - `search.sync`: fills documents that exist in Postgres but are missing from
    the live collections.
  Both share one concurrency key, so only one search job runs at a time.
- **Live view**: the dashboard (`/dashboard/jobs`) has a runs tab and a
  registered jobs tab; job pages stream progress and logs over Server-Sent
  Events (`GET /api/jobs/dashboard/:id/stream`, proxied by a Next route handler),
  with polling as fallback.
- **Adding a job type**: implement the `JobHandler` trait in `apps/worker`, register
  it, and add the type to `JOB_TYPES` in `apps/api/src/modules/jobs/job-types.ts`.

Full spec: [jobs-worker.md](jobs-worker.md).

## Database

Drizzle schema in `packages/db/src/schema/` (`users`, `sessions`, `posts`,
`pages`, `projects`, `packages`, `localizations`, `games`, `jobs`). Migrations
are always generated (`db:generate`), never hand-written; generated files may only
receive data backfill steps. Migrations are applied manually
(`pnpm --filter @vefacaglar/db db:migrate`); CD never migrates.

## Deployment and CI

| Workflow | What it does |
|---|---|
| `.github/workflows/api-ci.yml` | Typecheck + tests, multi-arch image to GHCR, blue-green deploy to the VPS behind Caddy (`deploy/api`) |
| `.github/workflows/worker-ci.yml` | `cargo fmt` / `clippy` / `test`, image to GHCR, deploy to the VPS (`deploy/worker`, gated by `WORKER_DEPLOY_ENABLED`) |
| `.github/workflows/catalog-import.yml` | Scheduled IGDB catalog import every 6 hours |

The web app deploys on Vercel. The local `.env` points at production services,
so the worker is not part of `pnpm dev` and any local job run touches live data.
