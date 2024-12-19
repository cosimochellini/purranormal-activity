import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const log = sqliteTable('log', {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  description: text().notNull(),
  category: text().notNull(),
})
