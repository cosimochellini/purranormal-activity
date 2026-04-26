# Implementation Plan: Deepen Telegram Notification Behind a `Notifier`

**Branch**: `004-notifier-deepen` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-notifier-deepen/spec.md`

## Summary

Introduce a deep `Notifier` module at `services/notifier/` that owns
multi-chat fan-out and partial-success accounting. Collapse
`services/telegram/index.ts` to single-chat primitives. Cut over the only
caller (`start/routes/api/telegram/$id.ts`) and surface the new diagnostics
through an optional `partial` field on `TelegramIdResponse`. Delete
`services/notification.ts`. Add tests for both the notifier and the new
single-chat primitives. Single PR to `main` from branch
`004-notifier-deepen`.

## Technical Context

**Language/Version**: TypeScript 6.x (strict mode), Node 22.12+.
**Primary Dependencies**: TanStack Start, Vite 8, React 19, Drizzle 0.45 +
Turso, OpenAI 6, Vitest 4, Biome 2.4. No new deps.
**Storage**: Turso (SQLite, HTTP) — not touched by this feature.
**Testing**: Vitest with happy-dom (components/hooks) + node (services/
utils/env). Boundary mocking via `vi.mock`. New tests under
`services/notifier/notifier.test.ts`, `services/telegram/index.test.ts`,
and rewrite at `tests/api/telegram.$id.test.ts`.
**Target Platform**: Cloudflare Workers (production); Node 22 (CI).
**Project Type**: web app (frontend + serverless backend).
**Performance Goals**: `Promise.all` fan-out — wall time = max(per-chat),
not sum. For ~2 chats, indistinguishable from sequential.
**Constraints**: deterministic tests; no real network. The default
`notifier` singleton must lazily resolve env-derived defaults so tests
that pass full deps never trigger env reads.
**Scale/Scope**: ~150 LOC of new code (`notifier/index.ts` + tests),
~120 LOC removed (legacy `notification.ts` + test), net neutral.

## Constitution Check

*Gate: must pass before Phase 0; re-check after design.*

| Principle | Compliance |
|---|---|
| I. Test-First Pragmatism | ✅ New module ships with boundary tests; coverage stays ≥50/50. |
| II. Boundary Mocking | ✅ `@/services/telegram` mocked in notifier tests; global `fetch` mocked in primitive tests via existing `tests/helpers.ts`. |
| III. Type-Safe Edges | ✅ `TelegramIdResponse` keeps its discriminated union; `partial` is optional and additive. Env reads stay through `env/telegram.ts`. |
| IV. Cloudflare-First Simplicity | ✅ No Node-only APIs. Route handler stays a plain async function. `Promise.all` is Workers-friendly. |
| V. Observability | ✅ All diagnostics route through the injected `Logger`. No `console.*` calls added. |

**Verdict**: All gates pass. No constitution violations; no Complexity
Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-notifier-deepen/
├── plan.md              # This file
├── spec.md              # Feature specification
├── tasks.md             # Task breakdown
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
purranormal-activity/
├── services/
│   ├── notifier/
│   │   ├── index.ts              # NEW — Notifier, NotifyOutcome, NotifierDeps, createNotifier, default singleton.
│   │   └── notifier.test.ts      # NEW — boundary tests for notify().
│   ├── telegram/
│   │   ├── index.ts              # MODIFIED — collapses to single-chat primitives.
│   │   ├── index.test.ts         # NEW — tests for the primitives (mocked fetch).
│   │   └── types.ts              # MODIFIED — adds ChatResult; drops chatIds from options; deletes SendEventNotificationResult.
│   └── notification.ts           # DELETED — superseded by services/notifier/.
│   └── notification.test.ts      # DELETED — replaced by services/notifier/notifier.test.ts.
├── start/routes/api/telegram/
│   └── $id.ts                    # MODIFIED — calls notifier.notify; maps outcome.
├── tests/api/
│   └── telegram.$id.test.ts      # MODIFIED — mocks @/services/notifier; covers partial branch.
├── types/api/
│   └── telegram-id.ts            # MODIFIED — adds optional partial on failure arm.
└── utils/
    └── logger.ts                 # MODIFIED — adds export interface Logger.
```

**Structure Decision**: Mirror the existing `services/telegram/` layout
for `services/notifier/` (folder with `index.ts` + `*.test.ts`). All
production code remains under existing top-level dirs.

## Phase 0 — Research (already completed)

Pre-plan exploration (Explore + Plan agents) surveyed:

1. `services/notification.ts:30` hardcodes the R2 host; `utils/public-image.ts:publicImage`
   already centralises the URL behind `VITE_CLOUDFLARE_PUBLIC_URL`.
2. `services/telegram/index.ts` lines 39–61 + 106–143 are the
   per-chat fan-out loops. Only one caller of `sendMessage`/`sendPhoto`
   exists today: `services/notification.ts:3`.
3. `start/routes/api/telegram/$id.ts:29` is the sole caller of
   `sendEventNotification`. `tests/api/telegram.$id.test.ts:8` mocks it.
4. `components/common/SendNotificationButton.tsx` consumes
   `TelegramIdResponse` via `success`/`messageId`/`error`. Adding an
   optional `partial` field is backward-compatible.
5. The existing test pattern uses `vi.hoisted` to install mock fns before
   the importing module is loaded — carry forward.

## Phase 1 — Architecture

### `Notifier` interface

```ts
export interface NotifyOutcome {
  delivered: boolean
  reachedChats: number
  totalChats: number
  failedPhotoChats: string[]
  messageId?: number
}

export interface Notifier {
  notify(event: LogWithCategories): Promise<NotifyOutcome>
}

export interface NotifierDeps {
  chatIds: string[]
  sendMessage:    (chatId: string, body: string) => Promise<ChatResult>
  sendPhoto:      (chatId: string, photoUrl: string) => Promise<ChatResult>
  composeMessage: (event: LogWithCategories) => Promise<string>
  resolveImageUrl:(id: number) => string
  logger: Logger
}

export const createNotifier: (deps?: Partial<NotifierDeps>) => Notifier
export const notifier: Notifier
```

### Single-chat primitives

```ts
// services/telegram/index.ts
export function sendMessage(chatId: string, body: string, opts?: SendMessageOptions): Promise<ChatResult>
export function sendPhoto(chatId: string, photoUrl: string, opts?: SendPhotoOptions): Promise<ChatResult>
```

`SendMessageOptions` defaults: `parseMode:'HTML'`, `disableWebPagePreview:true`, `silent:false`.
`SendPhotoOptions` defaults: `parseMode:'MarkdownV2'`, `silent:false` + the
existing pass-through fields. The `chatIds` field is **removed** from both
options — the primitive is single-chat by definition.

### Fan-out algorithm

`reachedChats` = chats whose **text** call succeeded. `failedPhotoChats`
contains chats whose text succeeded AND photo failed. A chat whose text
failed contributes to `(totalChats - reachedChats)` and is **not**
attempted for photo.

```text
notify(event):
  if chatIds.length === 0:
    return { delivered:false, reachedChats:0, totalChats:0, failedPhotoChats:[], messageId:undefined }

  text     = await composeMessage(event)        // once
  photoUrl = resolveImageUrl(event.id)          // once

  results = await Promise.all(chatIds.map(chatId => oneChat(chatId, text, photoUrl)))

  reachedChats     = results.filter(r => r.textOk).length
  failedPhotoChats = results.filter(r => r.textOk && !r.photoOk).map(r => r.chatId)
  delivered        = reachedChats === chatIds.length && failedPhotoChats.length === 0
  messageId        = lastDefined(results.filter(r => r.textOk).map(r => r.messageId))

  if !delivered:
    logger.warn('telegram fan-out partial', { eventId, reachedChats, totalChats, failedPhotoChats })

  return { delivered, reachedChats, totalChats, failedPhotoChats, messageId }

oneChat(chatId, text, photoUrl):  // own try/catch; one chat throwing must not poison others
  try:
    txt = await sendMessage(chatId, text)
    if !txt.success:
      logger.error('telegram text failed', { chatId, error: txt.error, eventId })
      return { chatId, textOk:false, photoOk:false, messageId:undefined }
    pho = await sendPhoto(chatId, photoUrl)
    if !pho.success:
      logger.error('telegram photo failed', { chatId, error: pho.error, eventId })
    return { chatId, textOk:true, photoOk: pho.success, messageId: txt.messageId }
  catch (e):
    logger.error('telegram chat threw', { chatId, error: e, eventId })
    return { chatId, textOk:false, photoOk:false, messageId:undefined }
```

### Route → response mapping

```ts
const outcome = await notifier.notify(event)
if (outcome.delivered) return ok({ success: true, messageId: outcome.messageId ?? 0 })

const error = outcome.reachedChats === 0
  ? 'Telegram fan-out failed'
  : 'Telegram fan-out partial'
return ok({
  success: false,
  error,
  partial: {
    reachedChats: outcome.reachedChats,
    totalChats: outcome.totalChats,
    failedPhotoChats: outcome.failedPhotoChats,
  },
})
```

## Phase 2 — Migration Order

Each commit ends with `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.

1. **`docs(spec): 004-notifier-deepen spec/plan/tasks`** — only files
   under `specs/004-notifier-deepen/`. No code change.
2. **`refactor(telegram,notifier): collapse primitives, introduce Notifier`** —
   add `Logger`; collapse telegram primitives + `services/telegram/index.test.ts`;
   add `services/notifier/{index.ts,notifier.test.ts}`; rewire
   `services/notification.ts` as a 3-line shim that delegates to the
   notifier and adapts the outcome to legacy `SendEventNotificationResult`
   so the route + button stay green during transition.
3. **`refactor(api/telegram): cut over to notifier`** — modify
   `start/routes/api/telegram/$id.ts` and `types/api/telegram-id.ts`;
   rewrite `tests/api/telegram.$id.test.ts`.
4. **`chore(notifier): remove legacy notification module`** — delete
   `services/notification.ts`, `services/notification.test.ts`, and
   `SendEventNotificationResult` + dead helpers in
   `services/telegram/types.ts`.

## Phase 3 — Verification

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage   # ≥50% lines AND ≥50% branches
pnpm build
pnpm cf-typegen      # diff-clean check
```

Smoke (manual after merge or via `pnpm preview`): `POST /api/telegram/42`
on a known event id; assert response shape and that the photo URL in
captured outbound payloads matches `publicImage(42)`.

## Risks & Mitigations

- **`messageId` lost on partial failure**: failure arm has no `messageId`.
  Acceptable — partial outcomes carry `partial` instead. The button UI
  already renders the `error` path.
- **Default singleton triggers env warning at import in tests**: defaults
  are *resolved lazily* inside `createNotifier`. Tests with full deps
  bypass entirely.
- **Coverage dip from deleting `notification.test.ts`**: offset by adding
  `services/notifier/notifier.test.ts` and `services/telegram/index.test.ts`.
- **Worktree path collision** with `.worktrees/004-x-invalidate/` (an
  unrelated branch in this repo). Use distinct path
  `.worktrees/004-notifier-deepen/`.
- **`routeTree.gen.ts`** regenerates on build — do not hand-edit; commit
  only if the build changed it.
