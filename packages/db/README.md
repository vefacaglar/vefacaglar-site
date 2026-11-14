# @vefacaglar/db

Drizzle schema, generated migrations and database tools for the monorepo. Run
commands from the repository root. The root `.env` supplies `DATABASE_URL`;
check which database it targets before running any command that changes data.

```sh
pnpm --filter @vefacaglar/db db:generate          # generate migrations from schema changes
pnpm --filter @vefacaglar/db db:migrate           # apply pending migrations
pnpm --filter @vefacaglar/db db:studio            # inspect data in Drizzle Studio
pnpm --filter @vefacaglar/db db:cleanup-sessions  # remove expired/old revoked sessions
```

Schema definitions are in `src/schema/`, generated SQL in `drizzle/`, and CLI
configuration in `drizzle.config.ts`. Follow [migration rules](../../AGENTS.md#database-migrations):
never hand-write migration DDL. Generated files may contain data/backfill steps.
`db:push` is available for disposable local databases, but does not replace the
migration workflow. When an API image is built and API or worker deployment is
enabled, CD applies pending migrations before deployment; see the
[deployment guide](../../deploy/api/README.md#database-migrations).

`pnpm --filter @vefacaglar/db db:seed` creates default content and, if absent, an
admin account with a known weak password. Use it only against an isolated local
database; do not seed production with those credentials.
