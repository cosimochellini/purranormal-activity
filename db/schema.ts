import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { LogStatus } from '../data/enum/logStatus'

export type LogStatusType = typeof LogStatus[keyof typeof LogStatus]

export const log = sqliteTable('log', {
  id: int('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  categories: text('categories').notNull(),
  createdAt: int('created_at').notNull(),
  updatedAt: int('updated_at').notNull(),
  status: text('status').notNull().default(LogStatus.Created),
  placeholder: text('placeholder'),
  error: text('error'),
  imageDescription: text('image_description'),
})

// Type definitions
export type Log = typeof log.$inferSelect
export type NewLog = typeof log.$inferInsert
