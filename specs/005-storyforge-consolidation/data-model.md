# Phase 1 Data Model: StoryForge Module Consolidation

## Public types (exported from `services/storyForge/index.ts`)

### `AIResult<T>`

Discriminated union returned by every intent method.

```ts
export type AIResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AIError; message: string }

export type AIError = 'parse' | 'model' | 'validation'
```

Field semantics:

| Field | Type | When | Notes |
|---|---|---|---|
| `ok` | `true` \| `false` | Always | Discriminator. |
| `value` | `T` | `ok: true` | The successful payload. |
| `error` | `'parse'` \| `'model'` \| `'validation'` | `ok: false` | Categorical failure code. |
| `message` | `string` | `ok: false` | Human-readable detail (typically the underlying `Error.message`). |

`AIError` codes:

- **`parse`** — `JSON.parse` of the model's text response threw.
- **`model`** — the model call itself threw (rate limit, network, timeout, auth).
- **`validation`** — the parsed JSON did not satisfy the expected shape.

### `QuestionSpec`

```ts
export interface QuestionSpec {
  question: string
  availableAnswers: string[]
}
```

Result of `storyForge.questions(description)` — array of follow-up questions presented to the user before they finalize a paranormal-event submission.

### `Answer`

```ts
export interface Answer {
  question: string
  answer: string
}
```

Argument shape for `storyForge.logDetails(description, answers[])`.

### `LogDetails`

```ts
export interface LogDetails {
  title: string
  description: string
  categories: { id: number; name: string }[]
  imageDescription: string
}
```

Result of `storyForge.logDetails(description, answers)` — the AI-enriched fields ready to be persisted into the `log` table.

### `StoryForge`

```ts
import type { LogWithCategories } from '@/db/schema'

export interface StoryForge {
  questions(description: string): Promise<AIResult<QuestionSpec[]>>
  logDetails(description: string, answers: Answer[]): Promise<AIResult<LogDetails>>
  imagePrompt(description: string): Promise<AIResult<string>>
  telegramMessage(log: LogWithCategories): Promise<AIResult<string>>
  invalidateCategories(): void
}
```

### Singleton + factory

```ts
export const storyForge: StoryForge        // production-wired default
export const createStoryForge: (deps?: Partial<Deps>) => StoryForge   // for tests
```

## Internal types (NOT exported)

### `Deps`

```ts
interface Deps {
  categories: { all(): Promise<Category[]>; invalidate(): void }
  llm: { text(opts: { model: string; prompt: string }): Promise<string> }
  randomStyle: () => ImageStyle
}

interface Category { id: number; name: string }
```

`Deps` parameterise everything I/O-bound or non-deterministic. Production wiring uses default Drizzle/openai adapters; tests pass stubs through `createStoryForge({ ... })`.

### Prompt template signatures (private)

```ts
function CREATE_QUESTIONS_PROMPT(description: string): string
function GENERATE_LOG_DETAILS_PROMPT(p: { description; answers; categories; currentStyle }): string
function GENERATE_IMAGE_PROMPT(p: { description; imageStyle }): string
function GENERATE_TELEGRAM_PROMPT(p: { log: LogWithCategories }): string
```

Re-used verbatim from today's `services/prompts.ts`. Italian wording preserved; reorganized only structurally.

## State transitions

The categories cache is a 2-state machine:

```
[empty] ──all()──▶ [populated]
   ▲                  │
   │                  │
   └── invalidate() ──┘
```

- `[empty]` → first `all()` call queries the DB and transitions to `[populated]`.
- `[populated]` → subsequent `all()` calls return the cached array WITHOUT querying.
- `invalidate()` from any state → `[empty]`.
- An empty DB result (`size=0`) does NOT memoize — the next `all()` call retries (matches existing `services/categories.ts:13` behaviour).

## Validation rules

Per intent method, applied INSIDE the StoryForge wrapper after `JSON.parse`:

| Method | Validation rule | Error code on failure |
|---|---|---|
| `questions` | Result is an array (possibly empty). Each entry has `question: string` and `availableAnswers: string[]`. | `validation` |
| `logDetails` | Result is an object with `title: string`, `description: string`, `categories: {id, name}[]`, `imageDescription: string`. | `validation` |
| `imagePrompt` | `text` from the model is a non-empty string. | `validation` |
| `telegramMessage` | `text` from the model is a non-empty string after HTML-fence stripping. | `validation` |

## Relationships

- `StoryForge` consumes `Deps`. `Deps` is internal — callers never construct it directly. Test injection happens via `createStoryForge(partial)` which deep-merges the partial against production defaults.
- The `categories` adapter is a per-StoryForge-instance closure cache. Two `createStoryForge()` calls produce two independent caches (important for test isolation).
- `LogWithCategories` is imported from `db/schema`; not redefined here.
