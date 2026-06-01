import { pgTable, uuid, text, timestamp, boolean, integer, date, index } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  githubUrl: text('github_url'),
  liveUrl: text('live_url'),
  coverImageUrl: text('cover_image_url'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  startedAt: date('started_at'),
  endedAt: date('ended_at'),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  statusFeaturedSortIdx: index('projects_status_featured_sort_idx').on(table.status, table.featured, table.sortOrder),
  statusPublishedIdx: index('projects_status_published_at_idx').on(table.status, table.publishedAt),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
