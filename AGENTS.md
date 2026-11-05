# AGENTS.md

## Project

Personal developer website for Vefa Çağlar.

This is a small personal site, not a SaaS product.

The site includes:

- Homepage
- About page
- Blog / writings
- Blog detail pages
- Projects page
- Later: small API and dahsboard/content tools

Keep everything simple.

## Tech Stack

Use:

- pnpm
- Turborepo
- TypeScript
- Next.js for `apps/web`
- Fastify for `apps/api`
- PostgreSQL later
- Drizzle later
- Plain CSS or CSS modules

Do not add heavy UI libraries.

Do not add Tailwind unless already installed.

Do not add authentication unless explicitly requested.

Do not add database logic unless explicitly requested.

## Web Styling & UI Standards (`apps/web`)

To maintain a consistent minimalist aesthetic and pristine code quality:
- **No Inline CSS**: Never use the `style={{ ... }}` attribute in React/Next.js components under any circumstances.
- **CSS Modules Only**: All component-specific styles must be declared inside modular CSS files (`*.module.css`) and imported as `styles`. Do not add custom global stylesheets or Tailwind classes. The deliberate shared-design exception is `packages/ui/src/theme.css` and `controls.css`, exported through `@vefacaglar/ui/styles.css` and imported once before the existing web globals. Keep canonical palette and shared control rules there; do not duplicate them in apps.
- **Color Palette Variables**: Do not hardcode hex, rgb, or named colors in component CSS files. Define palette values only in `packages/ui/src/theme.css` and use its predefined CSS variables, loaded by the web root layout:
  - Background: `var(--bg)`
  - Primary Text: `var(--text)`
  - Headings: `var(--text-heading)`
  - Muted: `var(--muted)`
  - Borders: `var(--border)`
  - Accents: `var(--accent)`
- **Predefined Button Classes**: Buttons must use the standard shared classes from `packages/ui/src/controls.css` (loaded through `@vefacaglar/ui/styles.css`):
  - Primary / Action buttons: Use `btnAccent`, or the shared `Button` component.
  - Secondary / Outline buttons: Use `btnGhost`, or `Button` with `variant="ghost"`.
  - Keep framework-specific link/navigation adapters inside their consuming app.
- **No Rounded Corners (Sharp Flat Aesthetic)**: All buttons, links styled as buttons, inputs, textareas, selectors, pagination controls, editor tabs, and interactive chips must have sharp, flat 90-degree square corners (`border-radius: 0;`). Under no circumstances should rounded corners (`border-radius` > 0) be added to interactive controls or standard components.

## Repository Structure

Expected structure:

```txt
apps/
  web/
  api/

packages/
  shared/
  db/
  ui/
```

## API Architecture & Conventions

For `apps/api`, follow the **Feature Folder** / **Handler Pattern** (similar to .NET's MediatR / CQRS approach):

- **Schemas & DTOs**: Use `@sinclair/typebox` to define single-source-of-truth schemas. Infer TypeScript types using `Static<typeof Schema>`.
- **Feature Folders**: Organize endpoints into separate feature folders (e.g., `src/modules/<module>/<feature>/`). Each feature should have:
  - `*.schema.ts`: Request/Response schemas and types.
  - `*.handler.ts`: Business/database logic inside a Handler class.
  - **Strict Separation of Concerns**: Public/external endpoints and admin/dashboard endpoints must **always** be separated into different features and endpoints (e.g. public blog list under `src/modules/posts/list/` vs. dashboard blog list under `src/modules/posts/dashboard/list/`). API endpoints must be page-specific, custom-tailored to their specific view/feature requirements, preventing raw administrative data/logic from leaking into public APIs.
- **Routes**: Define routing in a parent module file (e.g., `src/modules/<module>/<module>.routes.ts`). Route controllers must remain thin—only validating requests, invoking the handler, and mapping responses/errors.
- **No Direct DB Access in Handlers**: Handlers must **never** perform database operations or access Drizzle directly. All database access must be delegated:
  - If data is pulled from a **single data source**, use a **Repository** (e.g., `this.postsRepo.findBySlugWithAuthor(slug)`).
  - If data is pulled / orchestrated from **multiple distinct data sources**, use a **Service** class.
  - **Repository Domain Flexibility**: Repositories are **not** restricted to a single table schema. A repository belongs to a domain and can query multiple tables/schemas under that domain (e.g., a games repository can query games, developers, genres, themes, platforms, etc.).
- **Dependency Injection**: Use `tsyringe` for DI. Handlers must be decorated with `@injectable()` and receive repositories through `@inject(TOKEN)` constructor injection. All repository interfaces, implementations, and services must be registered in `src/container.ts`.
- **Transactions & DB Access**: Repositories must inject `DbProvider` and use `this.dbProvider.client` for all queries. Wrap multi-step writes in `this.dbProvider.transaction(async () => { ... })`. Never manually pass transaction (`tx`) parameters through layers, and never call the raw Drizzle `db.transaction()` directly; transaction propagation is handled implicitly via `AsyncLocalStorage` (`transactionStorage`) inside `DbProvider`.
- **Authorization & Route Guards**: Enforce endpoint authorization strictly at the routing layer (`*.routes.ts`) using Fastify pre-handler hooks (`preHandler: app.requireAdmin` or `preHandler: app.tryAuth`). Keep authorization checks out of feature handlers to maintain separation of concerns.
- **Database Content Localization**: To localize dynamic database entities (like posts, pages, or projects), inject `LanguageProvider` and use `mergeTranslations(row, translations)` inside your repository class. Always resolve dynamic translations under the `localizations` table at the database/repository level. **Crucial Optimization**: If the requested language is English (`'en'`) or not specified, **NEVER** query the `localizations` table or run `mergeTranslations` — return the raw database row immediately to avoid redundant DB calls.
- **Error & Localization**: Throw custom `HttpError` subclasses using predefined translation keys. The global error handler translates errors automatically using `translateError` based on `request.lang`.
- **Swagger Documentation**: Always register schemas in route options to support automated, typed OpenAPI documentation at `/swagger`.

## Background Jobs

Hangfire-style background jobs; the full spec is [docs/jobs-worker.md](docs/jobs-worker.md).

- **Worker**: `apps/worker` (Rust) claims and runs jobs (LISTEN/poll, heartbeat, checkpoint/resume, cancel, retries, recurring scheduler). Not part of `pnpm dev`; run it with `pnpm --filter worker worker:dev`.
- **Tables**: `jobs`, `job_logs`, `recurring_jobs`, `workers` — Drizzle schema in `packages/db/src/schema/jobs.ts`. Postgres is the only queue (no Redis).
- **API**: `apps/api/src/modules/jobs` (admin-only `/api/jobs/dashboard/...`). Enqueue = INSERT + `pg_notify('jobs', id)` + `pg_notify('job_events', id)` in one `this.dbProvider.transaction`.
- **Adding a job type**: (1) implement the `JobHandler` trait in a new Rust module under `apps/worker` and register it in the worker registry; (2) add an allowlist entry (English description + TypeBox payload schema + concurrency key) to `JOB_TYPES` in `apps/api/src/modules/jobs/job-types.ts`. Both sides must use the same type string.
- **Registered jobs**: rows in `recurring_jobs` (id = type); `cron` is nullable — null = manual-only (the worker scheduler ignores it). They are seeded by a migration data step, not by the worker. Every run of a registered type is linked via `jobs.recurring_job_id`.
- **Search jobs**: `search.reindex` (full reindex into new `{alias}__{timestamp}` collections, all aliases swapped at the end) and `search.sync` (upsert only documents missing from the live collections). Payload `{}`; both share concurrency key `search.index`. The API's search writer only does incremental per-document writes and alias-aware collection bootstrapping.
- **Live updates**: `GET /api/jobs/dashboard/:id/stream` (SSE: `snapshot` / `log` / `done`). Browsers connect directly to the API (never proxy SSE through Vercel) with a 120 s job-scoped token from `POST /api/jobs/dashboard/:id/stream-token` (`?token=`, `JOB_STREAM_TOKEN_SECRET`; route-level CORS from `WEB_ORIGINS`); never log the token. Any job state change (API or worker) must `pg_notify('job_events', job_id)` inside the same transaction; the API listens on one lazily opened connection (`PgJobEventsListener`). Never connect to Postgres at import time (serverless `src/app.ts`).

## Database Migrations

Never hand-write migration SQL files. Always edit the Drizzle schema in `packages/db/src/schema/` and generate the migration with `pnpm --filter @vefacaglar/db db:generate`. Editing a generated file is only allowed to insert a data/backfill step (e.g. `UPDATE` between `ADD COLUMN` and `SET NOT NULL`) — never to rewrite the DDL Drizzle produced.

## Testing (`apps/api`)

Unit tests use **Vitest**. The conventions below are firm constraints, not suggestions.

- **Colocation**: Tests live **next to the file they cover**, inside the same feature folder, named `<feature>.handler.spec.ts` (e.g. `src/modules/posts/list/list.handler.spec.ts`). Never create a separate `__tests__/` or root-level `test/` directory — that breaks the Feature Folder layout.
- **The unit is the Handler**: Unit tests target Handler classes — their input→output logic (query/param parsing, default values, response shaping such as `Date → ISO string`, and thrown `HttpError`s like `NotFoundError`). This is where the business logic lives.
- **No DI container, no real DB**: Instantiate the handler directly (`new ListPostsHandler(mockRepo)`), bypassing the `tsyringe` container. Mock every repository/service dependency — tests must **never** touch a real database, Drizzle, or the network. Mock repos as `Record<keyof IRepository, any>` with each method as `vi.fn()`.
- **`reflect-metadata`**: Every spec must start with `import "reflect-metadata";` (the handlers use decorators).
- **Do NOT unit-test**: thin route dispatchers (`*.routes.ts`), TypeBox schemas (`*.schema.ts`), or repositories/services that perform direct DB access. The repository/DB layer is out of scope for unit tests.
- **File naming**: Use `*.spec.ts` consistently. Do not mix in `*.test.ts`.
- **Build isolation**: Specs are excluded from the production build via `tsconfig.json` (`exclude: ["**/*.spec.ts", "vitest.config.ts"]`) and Vitest only scans `src/**/*.spec.ts` (pinned in `apps/api/vitest.config.ts`). Do not remove these guards — without them, compiled `dist/**/*.spec.js` files leak into the bundle and get double-run.
- **Commands**: `pnpm test` (all workspaces via Turborepo), `pnpm --filter api test` (API only), `pnpm --filter api test:watch` (watch mode).

## Testing (`apps/web`)

- **Vitest**, node environment, `TZ=UTC` pinned in `apps/web/vitest.config.ts` (scans `src/**/*.spec.ts` only).
- **Colocation**: specs sit next to the file they cover as `<file>.spec.ts` (e.g. `src/lib/formatDate.spec.ts`). Use `*.spec.ts` only; no `__tests__/` directories.
- **Scope**: pure logic and helpers only (formatters, parsers, URL/query builders, sorting, response mapping). No component, browser, or jsdom tests, and never a real network call.
- **Mocking**: mock `next/headers`, `next/navigation`, `next/cache`, React `cache`, `./httpClient` and server actions with `vi.mock` instead of changing source. Restore env/timers/mocks after each test (`vi.unstubAllEnvs`, `vi.resetAllMocks`, ...).
- **Commands**: `pnpm --filter web test`, `pnpm --filter web test:watch`.

## Development & Verification Guidelines

To verify code changes (syntax and TypeScript correctness) without disrupting the active local development server (`pnpm dev` / `next dev`):
- **NEVER** run `pnpm build` or `turbo run build` during active coding sessions. Doing so overwrites the `.next` directory and breaks Hot Module Replacement (HMR) for the active developer.
- **ALWAYS** use `pnpm typecheck` or `turbo run typecheck` to perform non-destructive, fast type checks.

## Deployment Constraints

- **API Entrypoint (`apps/api/package.json`)**: The `"main": "dist/app.js"` configuration in `apps/api/package.json` must **NEVER** be modified under any circumstances. While local development runs via `src/server.ts`, production deployment (e.g. Vercel serverless) points directly to `dist/app.js` which executes the serverless handler exported in `src/app.ts`. Do not change this main entrypoint or anything referencing it.

## Language

All visible UI text in `apps/web` must be in **English**. Use natural sentence capitalization and preserve proper product names. Do not force interface text to lowercase through CSS or string transformations; preserve user-authored content, URLs, slugs, and identifiers.

All git commit messages must be in **English**.

Keep the codebase, comments, logs, and user-facing copy in English only.

## Delegation and Agent Roles

The primary conversational model only coordinates the work: it interprets requests, assigns repository exploration, implementation, and verification to the project agents below, tracks their work, reviews returned evidence, and communicates the result to the user. It may split work, set scope, and synthesize or review results, but must not take over repository exploration, edits, or verification.

Use `site_explorer` for repository exploration, tracing behavior, and read-only investigation. Choose it for every coding task's initial codebase mapping. Use `site_routine_coder` for clear, low-to-medium-complexity implementation, including documentation and configuration changes. Use `site_complex_coder` for ambiguous, cross-cutting, architecture-sensitive, or otherwise difficult implementation. If a routine task proves materially more complex than expected, pause that assignment and delegate the expanded scope to `site_complex_coder`; do not continue the implementation in the coordinator.

Codex model mapping: `site_explorer` uses GPT-6 Luna, `site_routine_coder` uses GPT-6.1 Terra, and `site_complex_coder` uses GPT-6.1 Sol. Ask GPT-6 Astra for read-only architectural guidance on package boundaries, shared design contracts, and other cross-cutting decisions before implementation. Run Astra through an available explicit model selection; do not claim a native architect role exists unless it is actually configured. Terra also handles focused independent verification and routine follow-up fixes. Luna and Astra do not edit files or perform external actions. The primary conversation remains the coordinator throughout, including documentation edits and verification; it must delegate those tasks too. Claude Code mapping: the corresponding roles use Haiku, Sonnet, and Opus. These are distinct native project agents in `.codex/agents/` and `.claude/agents/`. Route work to the agent for the active harness. Keep the primary conversational model unchanged. The explorer role is configured for read-oriented work; its tool restrictions reduce available capabilities but do not constitute a security boundary, so it must be instructed not to mutate files or perform external actions.

Use no more than two agents concurrently. This coordinator-only restriction applies to the primary conversation, not to execution agents; assigned subagents perform their scoped investigation, edits, and checks themselves. Give each agent a precise task and disjoint write scope; reuse active agents when practical. Delegate code and documentation edits as well as exploration. Agents should return the findings, changed paths, and checks they actually ran. The coordinator integrates the results, reviews the changed files, and reports the outcome. Subagents do not start further subagents.

Do not silently substitute another model or move delegated work back to the coordinator when a requested role or model is unavailable. Report the limitation to the user clearly and continue only with independent work that remains possible. A project agent's configured model applies when that agent is loaded by a new or reloaded session; if the current session cannot load it or select its model, say so and do not claim it ran under that model.
