import { pgTable, uuid, text, timestamp, boolean, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const packageGroups = pgTable('package_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  githubUrl: text('github_url'),
  docs: text('docs'),
  latestVersion: text('latest_version').notNull().default('1.0.0'),
  isActive: boolean('is_active').notNull().default(true),
  content: text('content').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  isActiveCreatedIdx: index('package_groups_is_active_created_at_idx').on(table.isActive, table.createdAt),
}));

export const packages = pgTable('packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => packageGroups.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  nugetUrl: text('nuget_url'),
  npmUrl: text('npm_url'),
  githubUrl: text('github_url'),
  latestVersion: text('latest_version').notNull().default('1.0.0'),
  isActive: boolean('is_active').notNull().default(true),
  content: text('content').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  groupDisplayIdx: index('packages_group_id_created_at_idx').on(table.groupId, table.createdAt),
}));

export const docCategories = pgTable('doc_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => packageGroups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
}, (table) => ({
  groupSlugIdx: uniqueIndex('doc_categories_group_id_slug_idx').on(table.groupId, table.slug),
}));

export const docs = pgTable('docs', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => packageGroups.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .references(() => docCategories.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  filePath: text('file_path'),
  content: text('content').notNull().default(''),
  displayOrder: integer('display_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  groupSlugIdx: uniqueIndex('docs_group_id_slug_idx').on(table.groupId, table.slug),
}));

export type PackageGroup = typeof packageGroups.$inferSelect;
export type NewPackageGroup = typeof packageGroups.$inferInsert;

export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;

export type DocCategory = typeof docCategories.$inferSelect;
export type NewDocCategory = typeof docCategories.$inferInsert;

export type Doc = typeof docs.$inferSelect;
export type NewDoc = typeof docs.$inferInsert;
