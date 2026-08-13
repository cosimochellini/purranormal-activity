/* eslint-disable ts/no-use-before-define */

import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { LogStatus } from '@/data/enum/logStatus'

export const category = sqliteTable('category', {
  id: int('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  icon: text('icon').notNull(),
  createdAt: int('created_at').notNull(),
  updatedAt: int('updated_at').notNull(),
})

export const logCategory = sqliteTable('log_category', {
  logId: int('log_id')
    .notNull()
    .references(() => log.id, { onDelete: 'cascade' }),
  categoryId: int('category_id')
    .notNull()
    .references(() => category.id),
})

export const log = sqliteTable('log', {
  id: int('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  createdAt: int('created_at').notNull(),
  updatedAt: int('updated_at').notNull(),
  status: text('status').notNull().default(LogStatus.Created),
  error: text('error'),
  imageDescription: text('image_description'),
  // Generation attempts already claimed for the current cycle. Incremented in
  // SQL by `logRepository.claim` (never assigned from a queue message's
  // counter, which restarts at 1 on a sweeper re-enqueue) and reset to 0 when
  // an edit puts the row back into `Created`.
  attempts: int('attempts').notNull().default(0),
})

// Type definitions
export type Log = typeof log.$inferSelect
export type Category = typeof category.$inferSelect
export type SlimCategory = Pick<Category, 'id' | 'name' | 'icon'>
export type LogWithCategories = Log & { categories: number[] }
export type LogCategory = typeof logCategory.$inferSelect
