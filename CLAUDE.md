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

**`apps/web`** — Next.js 14 App Router. Public routes under `src/app/` (`/`, `/about`, `/blog`, `/blog/[slug]`, `/projects`). Admin/content tools live under `src/app/admin/` and use server actions (`admin/actions.ts`) to talk to the API. Uses `next-mdx-remote` to render markdown post bodies. Styling is plain CSS / CSS modules — do not add Tailwind or heavy UI libraries.

**`apps/api`** — Fastify with TypeBox schemas and auto-generated Swagger at `/swagger`. Health at `/health`. Routes registered in `src/app.ts` under `/api/auth`, `/api/posts`, `/api/pages`.

The API follows a strict **Feature Folder / Handler pattern**:
- `src/modules/<module>/<feature>/` contains `*.schema.ts` (TypeBox request/response schemas — `Static<typeof Schema>` infers TS types) and `*.handler.ts` (a Handler class with the business logic and DB calls).
- `src/modules/<module>/<module>.routes.ts` is a thin dispatcher: validates input via the registered schema, calls the handler, maps response/errors. Always register schemas on the route options so they appear in Swagger.
- Auth helpers (cookie/session, password hashing with scrypt) live in `modules/auth/auth.utils.ts`.

**`packages/db`** (`@vefacaglar/db`) — Drizzle ORM schemas in `src/schema/` (`users`, `sessions`, `posts`, `pages`, `projects`), exported via `src/index.ts`. Migrations are committed under `drizzle/`. Consumed by `apps/api`.

**`packages/shared`** (`@vefacaglar/shared`) — shared TS utilities, consumed by `apps/web`.

## Conventions

From `AGENTS.md` — these are firm constraints, not suggestions:
- This is a small personal site, not a SaaS product. Keep everything simple.
- Do **not** add Tailwind, heavy UI libraries, authentication, or database logic unless explicitly requested.
- All user-facing UI text, code/comments/logs, and git commit messages must be in **English**.
