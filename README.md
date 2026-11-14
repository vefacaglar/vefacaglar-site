# Vefa Çağlar's website

A personal website, game and movie library, admin dashboard, API and background
worker in a pnpm/Turborepo monorepo. See [architecture](docs/architecture.md)
for the system overview and [AGENTS.md](AGENTS.md) for repository conventions.

## Stack

- **Web:** Next.js 15, React 19, TypeScript, CSS Modules and the shared
  `@vefacaglar/ui` package.
- **API:** Fastify 5, TypeBox, tsyringe and OpenAPI/Swagger.
- **Data:** PostgreSQL and Drizzle ORM/Kit; PostgreSQL is also the job queue.
- **Search:** Meilisearch for games, catalog facets, posts, movies and movie
  people, with PostgreSQL fallback. The Rust worker handles bulk indexing.
- **Background jobs:** Rust (Tokio, SQLx and reqwest), PostgreSQL LISTEN/NOTIFY
  and SSE for dashboard progress.
- **Tests and tooling:** Vitest for API and web, Cargo for the worker, pnpm
  11.2.2 and Turborepo. CI uses Node.js 24.
- **Integrations:** ImageKit for uploads, IGDB for games, Wikidata and Wikipedia
  for movie catalog and interest data.

## Repository

```text
apps/web       Next.js site, library and dashboard
apps/api       Fastify API
apps/worker    Rust background worker
packages/db    Drizzle schema, migrations and database tools
packages/ui    Shared components, styles and design tokens
deploy/        Web, API and worker deployment scripts and guides
docs/          Architecture and feature contracts
```

The public library includes `/explore/games` and `/explore/movies`, game and
movie detail pages, and user profiles with game and movie activity. Legacy
`/games` and `/movies` paths redirect to `/explore`. The admin dashboard includes
content and job management.

## Local development

Use Node.js 24 (the version used by CI), pnpm 11.2.2, PostgreSQL and, for worker
changes, Rust 1.88 or newer. Meilisearch is optional for API search but required
for search jobs. Configure any integrations you need in a root `.env`:

```sh
cp .env.example .env
pnpm install
pnpm --filter @vefacaglar/db db:migrate
pnpm dev
```

Review `DATABASE_URL` and other service URLs before running database commands
or jobs. They operate on the configured services, which may be production.
`pnpm dev` builds the database workspace first and starts the development
servers; the worker is deliberately separate:

```sh
pnpm --filter worker worker:dev
```

The web app runs at `http://localhost:3000`, the API at
`http://localhost:3001`, Swagger at `http://localhost:3001/swagger`, and the
API health check at `http://localhost:3001/health`.

## Checks

```sh
pnpm typecheck                  # workspace type checks, including cargo check
pnpm test                       # workspace tests, including cargo test
pnpm lint                       # workspace lint tasks
pnpm --filter api test          # API handler tests
pnpm --filter web test          # web logic tests
pnpm --filter worker test       # Rust worker tests
pnpm --filter worker lint       # cargo clippy
```

Do not run `pnpm build` during an active development session: it can overwrite
Next.js output and interrupt HMR. See [AGENTS.md](AGENTS.md) for the complete
testing and verification rules.

## Database and jobs

Edit the Drizzle schema, then generate migrations with
`pnpm --filter @vefacaglar/db db:generate`; do not hand-write migration DDL.
Apply migrations to the configured database with `db:migrate`. When an API image is built and API or worker deployment is enabled, CD applies
pending migrations before deployment; see the
[API deployment guide](deploy/api/README.md#database-migrations). The seed
script creates a default admin with a weak password and is for isolated local
development only. See [database commands](packages/db/README.md).

The dashboard's registered jobs include `search.reindex` and `search.sync` for
games, facets and posts, and `search.movies.sync` for movies and people. They
share the `search.index` concurrency key. Catalog and popularity jobs are also
run by the worker. See [jobs](docs/jobs-worker.md),
[search](docs/search-meilisearch.md), and [movie search](docs/movie-search.md).

## Deployment and further documentation

GitHub Actions verifies affected components, builds images and, when enabled,
deploys the web app, API and worker to the VPS. When an API image is built and API or worker deployment is enabled, the workflow
runs pending database migrations before deployment. The catalog-import workflow runs the
IGDB importer every six hours. Deployment guides cover configuration, rollout
and recovery: [web](deploy/web/README.md), [API](deploy/api/README.md),
[worker](deploy/worker/README.md).

Feature details: [game ranking](docs/game-ranking.md),
[movie catalog](docs/movies-catalog.md), [movie activity](docs/movie-activity.md),
[movie interest](docs/movie-interest.md), [community ratings](docs/community-ratings.md),
and [application logs](docs/application-logs.md).
