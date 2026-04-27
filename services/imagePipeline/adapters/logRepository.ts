import { eq } from 'drizzle-orm'
import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import type { LogRepositoryPort, LogRow } from '../ports'

export const defaultLogRepository: LogRepositoryPort = {
  async insertDraft(draft) {
    const now = Date.now()
    const [row] = await db
      .insert(log)
      .values({
        title: draft.title,
        description: draft.description,
        imageDescription: draft.imageDescription,
        status: LogStatus.Created,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: log.id })
    return { id: row.id }
  },

  async linkCategories(logId, categoryIds) {
    if (categoryIds.length === 0) return
    await db.insert(logCategory).values(categoryIds.map((categoryId) => ({ logId, categoryId })))
  },

  async findById(id) {
    const [row] = await db
      .select({
        id: log.id,
        description: log.description,
        imageDescription: log.imageDescription,
        status: log.status,
      })
      .from(log)
      .where(eq(log.id, id))
    if (!row) return null
    return { ...row, status: row.status as LogStatus } satisfies LogRow
  },

  async findFirstPending() {
    const [row] = await db
      .select({ id: log.id })
      .from(log)
      .where(eq(log.status, LogStatus.Created))
      .orderBy(log.id)
      .limit(1)
    return row ? { id: row.id } : null
  },

  async loadStatus(id) {
    const [row] = await db.select({ status: log.status }).from(log).where(eq(log.id, id))
    if (!row) return null
    return { status: row.status as LogStatus }
  },

  async markImageGenerated(id) {
    await db.update(log).set({ status: LogStatus.ImageGenerated }).where(eq(log.id, id))
  },

  async markError(id, errorText) {
    await db.update(log).set({ status: LogStatus.Error, error: errorText }).where(eq(log.id, id))
  },
}
