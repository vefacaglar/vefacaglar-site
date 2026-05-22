import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const localizations = pgTable('localizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(), // e.g. 'page', 'post'
  entityId: uuid('entity_id').notNull(),
  languageCode: text('language_code').notNull(), // e.g. 'tr'
  field: text('field').notNull(), // e.g. 'title', 'content', 'seo_title', 'seo_description'
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  entityLanguageFieldIdx: uniqueIndex('entity_lang_field_idx').on(table.entityType, table.entityId, table.languageCode, table.field),
}));
export type Localization = typeof localizations.$inferSelect;
export type NewLocalization = typeof localizations.$inferInsert;
