/**
 * Production migration runner, executed by CD from the published API image:
 *   node packages/db/dist/migrate.js
 *
 * It applies the generated SQL in `packages/db/drizzle` with the same bookkeeping
 * as `drizzle-kit migrate` (`drizzle.__drizzle_migrations`, newest `created_at`
 * wins), so the two stay interchangeable. Everything runs in ONE transaction that
 * first takes a transaction-scoped advisory lock: concurrent runners serialize and
 * the later one sees nothing pending. A transaction-scoped lock (unlike a session
 * lock) also holds behind a transaction-pooling proxy such as PgBouncer.
 */
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';

const LOCK_NAME = 'vefacaglar:drizzle-migrations';

interface JournalEntry {
  tag: string;
  when: number;
}

function sanitize(message: string, secret: string): string {
  return secret ? message.split(secret).join('[DATABASE_URL]') : message;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const folder = process.env.MIGRATIONS_FOLDER ?? resolve(__dirname, '../drizzle');
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  const journal: { entries: JournalEntry[] } = JSON.parse(
    readFileSync(resolve(folder, 'meta/_journal.json'), 'utf8'),
  );
  const newest = migrations.reduce((max, migration) => Math.max(max, migration.folderMillis), 0);

  // One connection: the lock, the bookkeeping and every statement share a session.
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const applied = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${LOCK_NAME}))`;
      await tx`create schema if not exists "drizzle"`;
      await tx`
        create table if not exists "drizzle"."__drizzle_migrations" (
          id serial primary key,
          hash text not null,
          created_at bigint
        )
      `;
      const [last] = await tx<{ created_at: string | null }[]>`
        select created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1
      `;
      const lastApplied = last ? Number(last.created_at) : null;
      if (lastApplied !== null && lastApplied > newest) {
        // The database is ahead of this image (e.g. a redeploy of an older
        // commit). Nothing to apply; migrations are backward-compatible.
        console.log('Database schema is newer than this release; nothing to apply.');
      }
      const tags: string[] = [];
      for (const [index, migration] of migrations.entries()) {
        if (lastApplied !== null && lastApplied >= migration.folderMillis) {
          continue;
        }
        for (const statement of migration.sql) {
          if (statement.trim()) {
            await tx.unsafe(statement);
          }
        }
        await tx`
          insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
          values (${migration.hash}, ${migration.folderMillis})
        `;
        tags.push(journal.entries[index]?.tag ?? String(migration.folderMillis));
      }
      return tags;
    });
    if (applied.length) {
      console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`);
    } else {
      console.log(`Database schema is up to date (${migrations.length} migrations known).`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  const url = process.env.DATABASE_URL ?? '';
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : String(error);
  // Print only the database error; never the connection string.
  console.log(`Database migration failed${code ? ` (${code})` : ''}: ${sanitize(message, url)}`);
  process.exit(1);
});
