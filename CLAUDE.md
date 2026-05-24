# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless otherwise noted.

- `pnpm dev` — runs Next.js (`apps/web` on :3000) and Fastify (`apps/api` on :3001) in parallel via Turborepo.
- `pnpm build` — build all apps and packages.
- `pnpm typecheck` — run `tsc --noEmit` across the workspace.
- `pnpm lint` — currently only `apps/web` defines `lint` (Next lint).
- API-only dev: `pnpm --filter api dev`. Web-only dev: `pnpm --filter web dev`.

**Migration files must never be hand-written.** Always change `packages/db/src/schema/*.ts` and let `db:generate` produce the SQL under `packages/db/drizzle/`. Editing a generated file is only allowed to add a backfill/data step (e.g. `UPDATE` between `ADD COLUMN` and `SET NOT NULL`) — never to alter the DDL Drizzle emitted.

Database (Drizzle, against the `DATABASE_URL` in root `.env`):
- `pnpm --filter @vefacaglar/db db:push` — push schema directly (fast prototyping).
- `pnpm --filter @vefacaglar/db db:generate` — generate SQL migrations into `packages/db/drizzle/`.
- `pnpm --filter @vefacaglar/db db:migrate` — apply generated migrations.
- `pnpm --filter @vefacaglar/db db:seed` — seed default admin (`admin@vefacaglar.com` / `123`, scrypt-hashed).
- `pnpm --filter @vefacaglar/db db:studio` — Drizzle Studio UI.

No test runner is configured.

## Architecture

Turborepo + pnpm workspace. Two apps, two packages.

**`apps/web`** — Next.js 14 App Router. Public routes under `src/app/` (`/`, `/about`, `/blog`, `/blog/[slug]`, `/projects`). Dashboard/content tools live under `src/app/dashboard/` and use server actions (`dashboard/actions.ts`) to talk to the API. Uses `next-mdx-remote` to render markdown post bodies. Styling is plain CSS / CSS modules — do not add Tailwind or heavy UI libraries.

**`apps/api`** — Fastify with TypeBox schemas and auto-generated Swagger at `/swagger`. Health at `/health`. Routes registered in `src/app.ts` under `/api/auth`, `/api/posts`, `/api/pages`.

The API follows a strict **Feature Folder / Handler pattern**:
- `src/modules/<module>/<feature>/` contains `*.schema.ts` (TypeBox request/response schemas — `Static<typeof Schema>` infers TS types) and `*.handler.ts` (a Handler class with the business logic and DB calls). Handlers use `@injectable()` and constructor injection.
- `src/modules/<module>/<module>.routes.ts` is a thin dispatcher: validates input via the registered schema, resolves the handler from the container (`container.resolve(Handler)`), calls the handler, maps response/errors. Always register schemas on the route options so they appear in Swagger.
- **Dependency Injection**: Registered in `src/container.ts` using `tsyringe`. Handlers inject repository interfaces using injection tokens (e.g. `POSTS_REPOSITORY`).
- **Implicit Transactions**: Done via `DbProvider` and `TransactionManager` utilizing `AsyncLocalStorage` (`transactionStorage`). Repositories use `this.dbProvider.client` for query execution, avoiding passing around `tx` parameters.
- **Authorization / Route Guards**: Enforced at the route definition using `preHandler: app.requireAdmin` or `preHandler: app.tryAuth` options. Keep checks out of handler logic.
- **Db Content Localization**: Dynamic content translations are resolved in repositories by injecting `LanguageProvider` and using `mergeTranslations(row, translations)`. **Crucial Optimization**: If the requested language is English (`'en'`) or not specified, **NEVER** query the `localizations` table or run `mergeTranslations` — return the raw row immediately to avoid redundant DB calls.
- **Error / Localization**: Global error handling via `app.setErrorHandler` translates thrown `HttpError` keys based on `request.lang` using `translateError`.
- Auth helpers (cookie/session, password hashing with scrypt) live in `modules/auth/auth.utils.ts`.

**`packages/db`** (`@vefacaglar/db`) — Drizzle ORM schemas in `src/schema/` (`users`, `sessions`, `posts`, `pages`, `projects`), exported via `src/index.ts`. Migrations are committed under `drizzle/`. Consumed by `apps/api`.

**`packages/shared`** (`@vefacaglar/shared`) — shared TS utilities, consumed by `apps/web`.

## Conventions

From `AGENTS.md` — these are firm constraints, not suggestions:
- This is a small personal site, not a SaaS product. Keep everything simple.
- **API Entrypoint**: The `"main": "dist/app.js"` in `apps/api/package.json` must **NEVER** be modified. Production deployment (Vercel) points to it, while local dev uses `src/server.ts`. Do not change this main entrypoint or anything referencing it.
- **Web Styling & UI Rules**:
  - **No Inline CSS**: Never use the `style={{ ... }}` attribute under any circumstances.
  - **CSS Modules Only**: Use `*.module.css` imported as `styles`. No custom global CSS or Tailwind.
  - **Colors & Palette**: Always use variables from `globals.css` (`var(--bg)`, `var(--text)`, `var(--text-heading)`, `var(--muted)`, `var(--border)`, `var(--accent)`). Never hardcode hex/rgb colors.
  - **Buttons**: Must strictly use standard classes from `globals.css`: `btnAccent` (primary) and `btnGhost` (secondary).
- Do **not** add Tailwind, heavy UI libraries, authentication, or database logic unless explicitly requested.
- All user-facing UI text, code/comments/logs, and git commit messages must be in **English**.
