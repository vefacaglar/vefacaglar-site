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
- Later: small API and admin/content tools

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
- **Routes**: Define routing in a parent module file (e.g., `src/modules/<module>/<module>.routes.ts`). Route controllers must remain thin—only validating requests, invoking the handler, and mapping responses/errors.
- **Swagger Documentation**: Always register schemas in route options to support automated, typed OpenAPI documentation at `/swagger`.

## Language

All visible UI text in `apps/web` must be in **English**.

All git commit messages must be in **English**.

Keep the codebase, comments, logs, and user-facing copy in English only.