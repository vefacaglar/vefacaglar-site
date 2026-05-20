"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posts = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.posts = (0, pg_core_1.pgTable)('posts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    slug: (0, pg_core_1.text)('slug').notNull().unique(),
    title: (0, pg_core_1.text)('title').notNull(),
    excerpt: (0, pg_core_1.text)('excerpt'),
    content: (0, pg_core_1.text)('content').notNull(),
    status: (0, pg_core_1.text)('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    coverImageUrl: (0, pg_core_1.text)('cover_image_url'),
    seoTitle: (0, pg_core_1.text)('seo_title'),
    seoDescription: (0, pg_core_1.text)('seo_description'),
    publishedAt: (0, pg_core_1.timestamp)('published_at', { withTimezone: true, mode: 'date' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
