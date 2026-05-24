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
- **CSS Modules Only**: All component styles must be declared inside modular CSS files (`*.module.css`) and imported as `styles`. Do not add custom global stylesheets or Tailwind classes.
- **Color Palette Variables**: Do not hardcode hex, rgb, or named colors in CSS files. Always use the predefined CSS variables from [globals.css](file:///Users/vefa/Projects/vefacaglar-site/apps/web/src/app/globals.css):
  - Background: `var(--bg)`
  - Primary Text: `var(--text)`
  - Headings: `var(--text-heading)`
  - Muted: `var(--muted)`
  - Borders: `var(--border)`
  - Accents: `var(--accent)`
- **Predefined Button Classes**: Buttons must strictly use the standard classes defined in `globals.css`:
  - Primary / Action buttons: Use `btnAccent` from `globals.css` (imported or referenced).
  - Secondary / Outline buttons: Use `btnGhost` from `globals.css`.
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
- **Transactions & DB Access**: Repositories must inject `DbProvider` and use `this.dbProvider.client` for all queries. Never manually pass transaction (`tx`) parameters through layers; transaction propagation is handled implicitly via `AsyncLocalStorage` (`transactionStorage`) inside `TransactionManager`.
- **Authorization & Route Guards**: Enforce endpoint authorization strictly at the routing layer (`*.routes.ts`) using Fastify pre-handler hooks (`preHandler: app.requireAdmin` or `preHandler: app.tryAuth`). Keep authorization checks out of feature handlers to maintain separation of concerns.
- **Database Content Localization**: To localize dynamic database entities (like posts, pages, or projects), inject `LanguageProvider` and use `mergeTranslations(row, translations)` inside your repository class. Always resolve dynamic translations under the `localizations` table at the database/repository level. **Crucial Optimization**: If the requested language is English (`'en'`) or not specified, **NEVER** query the `localizations` table or run `mergeTranslations` — return the raw database row immediately to avoid redundant DB calls.
- **Error & Localization**: Throw custom `HttpError` subclasses using predefined translation keys. The global error handler translates errors automatically using `translateError` based on `request.lang`.
- **Swagger Documentation**: Always register schemas in route options to support automated, typed OpenAPI documentation at `/swagger`.

## Database Migrations

Never hand-write migration SQL files. Always edit the Drizzle schema in `packages/db/src/schema/` and generate the migration with `pnpm --filter @vefacaglar/db db:generate`. Editing a generated file is only allowed to insert a data/backfill step (e.g. `UPDATE` between `ADD COLUMN` and `SET NOT NULL`) — never to rewrite the DDL Drizzle produced.

## Development & Verification Guidelines

To verify code changes (syntax and TypeScript correctness) without disrupting the active local development server (`pnpm dev` / `next dev`):
- **NEVER** run `pnpm build` or `turbo run build` during active coding sessions. Doing so overwrites the `.next` directory and breaks Hot Module Replacement (HMR) for the active developer.
- **ALWAYS** use `pnpm typecheck` or `turbo run typecheck` to perform non-destructive, fast type checks.

## Deployment Constraints

- **API Entrypoint (`apps/api/package.json`)**: The `"main": "dist/app.js"` configuration in `apps/api/package.json` must **NEVER** be modified under any circumstances. While local development runs via `src/server.ts`, production deployment (e.g. Vercel serverless) points directly to `dist/app.js` which executes the serverless handler exported in `src/app.ts`. Do not change this main entrypoint or anything referencing it.

## Language

All visible UI text in `apps/web` must be in **English**.

All git commit messages must be in **English**.

Keep the codebase, comments, logs, and user-facing copy in English only.