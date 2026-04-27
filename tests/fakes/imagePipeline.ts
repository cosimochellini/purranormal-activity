import { LogStatus } from '@/data/enum/logStatus'
import { createImagePipeline } from '@/services/imagePipeline/core'
import type {
  AiImagePort,
  AiTextPort,
  ImagePipeline,
  ImageStorePort,
  LogRepositoryPort,
  LogRow,
  PipelineDeps,
} from '@/services/imagePipeline/ports'
import type { AIResult } from '@/services/storyForge'

// In-memory implementations of the four pipeline ports plus a
// `createTestPipeline` helper that wires them together. Used by
// `services/imagePipeline/index.test.ts` to exercise the orchestrator
// without any per-seam `vi.mock` of `@/drizzle`, `@/services/imageGen`,
// `@/services/storyForge`, or `@/utils/cloudflare`.

export interface InMemoryAiText extends AiTextPort {
  setResult(r: AIResult<string>): void
  setThrow(err: unknown): void
  calls: Array<{ description: string }>
}

export const createInMemoryAiText = (
  initial: AIResult<string> = { ok: true, value: 'fake-prompt' },
): InMemoryAiText => {
  let result: AIResult<string> = initial
  let toThrow: unknown
  let shouldThrow = false
  const calls: Array<{ description: string }> = []
  return {
    async imagePrompt(description) {
      calls.push({ description })
      if (shouldThrow) throw toThrow
      return result
    },
    setResult(r) {
      result = r
    },
    setThrow(err) {
      toThrow = err
      shouldThrow = true
    },
    calls,
  }
}

export interface InMemoryAiImage extends AiImagePort {
  setResult(r: string): void
  setThrow(err: unknown): void
  calls: Array<{ prompt: string }>
}

export const createInMemoryAiImage = (
  // 'aGVsbG8=' is the base64 of 'hello' — small, harmless, decodable by atob.
  initial = 'data:image/png;base64,aGVsbG8=',
): InMemoryAiImage => {
  let result = initial
  let toThrow: unknown
  let shouldThrow = false
  const calls: Array<{ prompt: string }> = []
  return {
    async generateBase64(prompt) {
      calls.push({ prompt })
      if (shouldThrow) throw toThrow
      return result
    },
    setResult(r) {
      result = r
    },
    setThrow(err) {
      toThrow = err
      shouldThrow = true
    },
    calls,
  }
}

export interface InMemoryImageStore extends ImageStorePort {
  snapshot(): Map<number, Uint8Array>
  setPutThrow(err: unknown): void
  setDeleteThrow(err: unknown): void
}

export const createInMemoryImageStore = (): InMemoryImageStore => {
  const data = new Map<number, Uint8Array>()
  let putThrow: unknown
  let putShouldThrow = false
  let delThrow: unknown
  let delShouldThrow = false
  return {
    async put(logId, bytes) {
      if (putShouldThrow) throw putThrow
      data.set(logId, bytes)
    },
    async delete(logId) {
      if (delShouldThrow) throw delThrow
      data.delete(logId)
    },
    snapshot() {
      return new Map(data)
    },
    setPutThrow(err) {
      putThrow = err
      putShouldThrow = true
    },
    setDeleteThrow(err) {
      delThrow = err
      delShouldThrow = true
    },
  }
}

interface InMemoryRow extends LogRow {
  title: string
  categoryIds: number[]
  error: string | null
}

export interface InMemoryRepoSeed {
  id: number
  title?: string
  description?: string
  imageDescription?: string | null
  status?: LogStatus
  categoryIds?: number[]
  error?: string | null
}

export interface InMemoryLogRepository extends LogRepositoryPort {
  preload(rows: InMemoryRepoSeed[]): void
  rows(): InMemoryRow[]
  findRow(id: number): InMemoryRow | undefined
  setInsertThrow(err: unknown): void
  setLinkThrow(err: unknown): void
  setLoadStatusThrow(err: unknown): void
  setMarkGeneratedThrow(err: unknown): void
  setMarkErrorThrow(err: unknown): void
}

export const createInMemoryLogRepository = (): InMemoryLogRepository => {
  const rowsById = new Map<number, InMemoryRow>()
  let nextId = 1
  let insertThrow: unknown
  let insertShouldThrow = false
  let linkThrow: unknown
  let linkShouldThrow = false
  let loadStatusThrow: unknown
  let loadStatusShouldThrow = false
  let markGeneratedThrow: unknown
  let markGeneratedShouldThrow = false
  let markErrorThrow: unknown
  let markErrorShouldThrow = false

  return {
    async insertDraft(draft) {
      if (insertShouldThrow) throw insertThrow
      const id = nextId++
      rowsById.set(id, {
        id,
        title: draft.title,
        description: draft.description,
        imageDescription: draft.imageDescription,
        status: LogStatus.Created,
        categoryIds: [],
        error: null,
      })
      return { id }
    },

    async linkCategories(logId, categoryIds) {
      if (linkShouldThrow) throw linkThrow
      if (categoryIds.length === 0) return
      const row = rowsById.get(logId)
      if (row) row.categoryIds.push(...categoryIds)
    },

    async findById(id) {
      const row = rowsById.get(id)
      if (!row) return null
      return {
        id: row.id,
        description: row.description,
        imageDescription: row.imageDescription,
        status: row.status,
      }
    },

    async findFirstPending() {
      const ids = Array.from(rowsById.keys()).sort((a, b) => a - b)
      for (const id of ids) {
        const row = rowsById.get(id)
        if (row && row.status === LogStatus.Created) return { id: row.id }
      }
      return null
    },

    async loadStatus(id) {
      if (loadStatusShouldThrow) throw loadStatusThrow
      const row = rowsById.get(id)
      if (!row) return null
      return { status: row.status }
    },

    async markImageGenerated(id) {
      if (markGeneratedShouldThrow) throw markGeneratedThrow
      const row = rowsById.get(id)
      if (row) row.status = LogStatus.ImageGenerated
    },

    async markError(id, errorText) {
      if (markErrorShouldThrow) throw markErrorThrow
      const row = rowsById.get(id)
      if (row) {
        row.status = LogStatus.Error
        row.error = errorText
      }
    },

    preload(rows) {
      for (const seed of rows) {
        const row: InMemoryRow = {
          id: seed.id,
          title: seed.title ?? 'Test',
          description: seed.description ?? 'Test description',
          imageDescription: seed.imageDescription ?? null,
          status: seed.status ?? LogStatus.Created,
          categoryIds: seed.categoryIds ?? [],
          error: seed.error ?? null,
        }
        rowsById.set(row.id, row)
        if (row.id >= nextId) nextId = row.id + 1
      }
    },

    rows() {
      return Array.from(rowsById.values())
    },

    findRow(id) {
      return rowsById.get(id)
    },

    setInsertThrow(err) {
      insertThrow = err
      insertShouldThrow = true
    },
    setLinkThrow(err) {
      linkThrow = err
      linkShouldThrow = true
    },
    setLoadStatusThrow(err) {
      loadStatusThrow = err
      loadStatusShouldThrow = true
    },
    setMarkGeneratedThrow(err) {
      markGeneratedThrow = err
      markGeneratedShouldThrow = true
    },
    setMarkErrorThrow(err) {
      markErrorThrow = err
      markErrorShouldThrow = true
    },
  }
}

export interface TestPipeline {
  pipeline: ImagePipeline
  aiText: InMemoryAiText
  aiImage: InMemoryAiImage
  store: InMemoryImageStore
  repo: InMemoryLogRepository
}

export const createTestPipeline = (overrides: Partial<PipelineDeps> = {}): TestPipeline => {
  const aiText = createInMemoryAiText()
  const aiImage = createInMemoryAiImage()
  const store = createInMemoryImageStore()
  const repo = createInMemoryLogRepository()

  const pipeline = createImagePipeline({
    aiText: overrides.aiText ?? aiText,
    aiImage: overrides.aiImage ?? aiImage,
    store: overrides.store ?? store,
    repo: overrides.repo ?? repo,
  })

  return { pipeline, aiText, aiImage, store, repo }
}
