import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as postsSchema from './schema/posts';
import * as pagesSchema from './schema/pages';
import * as projectsSchema from './schema/projects';
import * as usersSchema from './schema/users';
import * as sessionsSchema from './schema/sessions';
import * as localizationsSchema from './schema/localizations';
import * as gamesSchema from './schema/games';
import * as packagesSchema from './schema/packages';

// Export all schemas
export * from './schema/posts';
export * from './schema/pages';
export * from './schema/projects';
export * from './schema/users';
export * from './schema/sessions';
export * from './schema/localizations';
export * from './schema/games';
export * from './schema/packages';

export const schema = {
  ...postsSchema,
  ...pagesSchema,
  ...projectsSchema,
  ...usersSchema,
  ...sessionsSchema,
  ...localizationsSchema,
  ...gamesSchema,
  ...packagesSchema,
};

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vefa_site';

const queryClient = postgres(databaseUrl);
export const db = drizzle(queryClient, { schema });
export type DbType = typeof db;
