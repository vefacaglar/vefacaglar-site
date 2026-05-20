import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
