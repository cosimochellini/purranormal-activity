import { and, eq, inArray, lt, sql } from 'drizzle-orm'
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

  async findPending(limit) {
    return db
      .select({ id: log.id })
      .from(log)
      .where(eq(log.status, LogStatus.Created))
      .orderBy(log.id)
      .limit(limit)
  },

  async findStalePending({ cutoff, limit }) {
    return db
      .select({ id: log.id, attempts: log.attempts })
      .from(log)
      .where(and(eq(log.status, LogStatus.Created), lt(log.updatedAt, cutoff)))
      .orderBy(log.updatedAt)
      .limit(limit)
  },

  async loadState(id) {
    const [row] = await db
      .select({ status: log.status, attempts: log.attempts })
      .from(log)
      .where(eq(log.id, id))
    if (!row) return null
    return { status: row.status as LogStatus, attempts: row.attempts }
  },

  async claim(id, maxAttempts) {
    // One conditional UPDATE ... RETURNING is the whole point: SQLite applies
    // it atomically, so two concurrent deliveries of the same logId cannot
    // both be granted the same attempt, and the `attempts < maxAttempts`
    // predicate makes the budget enforceable rather than advisory.
    // `attempts + 1` is computed in SQL — assigning a queue message's own
    // counter would reset to 1 on every sweeper re-enqueue and never
    // terminate.
    const [row] = await db
      .update(log)
      .set({ attempts: sql`${log.attempts} + 1`, updatedAt: Date.now() })
      .where(and(eq(log.id, id), eq(log.status, LogStatus.Created), lt(log.attempts, maxAttempts)))
      .returning({ attempts: log.attempts })
    return row ? { attempt: row.attempts } : null
  },

  async touchPending(ids) {
    if (ids.length === 0) return
    // The `status = Created` predicate makes the lease renewal a no-op for
    // rows that finished between the scan and this write.
    await db
      .update(log)
      .set({ updatedAt: Date.now() })
      .where(and(inArray(log.id, ids), eq(log.status, LogStatus.Created)))
  },

  async requeueForRetry(id) {
    const [row] = await db
      .update(log)
      .set({
        status: LogStatus.Created,
        attempts: 0,
        error: null,
        updatedAt: Date.now(),
      })
      .where(eq(log.id, id))
      .returning({ id: log.id })
    return row ? { id: row.id } : null
  },

  async markImageGenerated(id) {
    // Clearing `error` matters: a row that failed, was retried and then
    // succeeded used to keep its stale failure text forever.
    await db
      .update(log)
      .set({ status: LogStatus.ImageGenerated, error: null, updatedAt: Date.now() })
      .where(eq(log.id, id))
  },

  async markError(id, errorText) {
    // `attempts` is left as the claim set it — this write only makes the
    // failure terminal.
    //
    // Guarded on `Created` because terminating a pending row is the only thing
    // this is ever for. Without the guard, a caller that could not read the row
    // first (a dead-letter hop whose `loadState` threw) would assume it is
    // pending and could flip a row that had meanwhile succeeded to `Error`,
    // hiding a perfectly good cover. Every intended caller holds a claim on a
    // `Created` row, so the guard never costs a legitimate write.
    await db
      .update(log)
      .set({ status: LogStatus.Error, error: errorText, updatedAt: Date.now() })
      .where(and(eq(log.id, id), eq(log.status, LogStatus.Created)))
  },
}
