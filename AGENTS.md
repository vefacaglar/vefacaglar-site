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