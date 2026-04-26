# Implementation Plan: Delete cache no-op, ship `X-Invalidate` revalidation

**Branch**: `004-x-invalidate-revalidation` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Source**: GitHub Issue [#8](https://github.com/cosimochellini/purranormal-activity/issues/8)

---

## Summary

Replace `services/content.ts::invalidatePublicContent` (a logger.info-only no-op) and the `<Refetch>` polling component with a TanStack Router-native revalidation contract driven by an `X-Invalidate` response header. Server mutations tag the resources they touched (`logs`, `log:${id}`); the client `fetcher` reads the header and calls `router.invalidate({ filter })` against the live router singleton. No new dependencies; the header maps 1:1 to `Cache-Tag` if an edge cache layer is added later.

---

## Technical Context

**Language/Version**: TypeScript 6.x, React 19, Node 22.12+
**Primary Dependencies**: TanStack Start 1.162.9, TanStack Router 1.162.9, Vite 8.x, `@cloudflare/vite-plugin` 1.25.5, drizzle-orm/libsql, zod
**Storage**: Turso (SQLite) — unchanged by this feature
**Testing**: Vitest (`node` env default; `happy-dom` per-file pragma for components), `@testing-library/react`
**Target Platform**: Cloudflare Workers (production), Node 22 (CI/local dev)
**Project Type**: Web application (single repo, no separate front/backend split)
**Performance Goals**: One additional response-header read per mutation; one `router.invalidate` per response with `X-Invalidate`. Negligible (<1 ms per call) on the hot path.
**Constraints**: Cloudflare-Workers-compatible (no Node-only APIs in hot paths); SSR-safe (interceptor must no-op when no client router is mounted).
**Scale/Scope**: ~6 mutation routes, ~6 source-file edits, ~3 test files updated, ~5 new test files; targeted scope.

---

## Constitution Check (`/.specify/memory/constitution.md` v1.0.0)

| Principle | Compliance plan |
| --- | --- |
| **I. Test-First Pragmatism** | Each phase ships with tests. Coverage thresholds (≥50% lines/branches) preserved (more tests added than removed). Vitest stays sole runner. |
| **II. Boundary Mocking** | `getActiveRouter` mocked in fetcher tests via `vi.hoisted`. No real TanStack Router instance instantiated in unit tests. Existing OpenAI / drizzle mocks untouched. |
| **III. Type-Safe Edges** | `InvalidationTag` is a discriminated string literal type; `ok<T>(body, init?)` keeps generic body typing; mutation routes still use Zod for input validation (unchanged). |
| **IV. Cloudflare-First Simplicity** | No new wrangler bindings. `X-Invalidate` is a plain `Response` header — no Workers-specific API. `vitest.config.ts` continues to exclude TanStack Start / Cloudflare plugins. |
| **V. Observability** | Fetcher interceptor catches `router.invalidate` failures via `logger.error`; never `console.*`. Delete the `logger.info('Content invalidation requested (currently no-op)')` line — eliminates dead log noise. |

**Gate**: PASS at design time. Re-check after Phase 1 implementation.

**Complexity Tracking**: No violations to justify. Net code is *removed* (one no-op function, one polling component, several test mocks).

---

## Project Structure

### Documentation (this feature)

```text
specs/004-x-invalidate-revalidation/
├── spec.md              # Feature specification (issue #8 distilled)
├── plan.md              # This file
├── tasks.md             # Generated next (/speckit-tasks)
└── checklists/
    └── requirements.md  # Quality gate checklist
```

### Source Code (repository root)

```text
purranormal-activity/
├── utils/
│   ├── http.ts                       # MODIFY: ok() accepts { invalidate? } → emits X-Invalidate
│   ├── http.test.ts                  # NEW
│   ├── fetch.ts                      # MODIFY: read X-Invalidate, call router.invalidate
│   ├── fetch.test.ts                 # NEW
│   ├── invalidation.ts               # NEW: InvalidationTag type + matchesTags()
│   └── invalidation.test.ts          # NEW
├── start/
│   ├── router.tsx                    # MODIFY: capture client router in module-scope ref;
│   │                                 # export getActiveRouter()
│   └── routes/api/
│       ├── log/submit.ts             # MODIFY: add invalidate on success
│       ├── log/$id.ts                # MODIFY: add invalidate on PUT and DELETE success
│       ├── log.ts                    # MODIFY: add invalidate on POST success
│       ├── log/$id/categories.ts     # MODIFY: add invalidate on POST success
│       └── trigger/$id.ts            # MODIFY: add invalidate on success+caught-error;
│                                     # remove invalidatePublicContent
├── services/
│   ├── content.ts                    # MODIFY: delete invalidatePublicContent + its call
│   ├── content.test.ts               # MODIFY: delete describe('invalidatePublicContent', …)
│   ├── script.ts                     # MODIFY: delete invalidatePublicContent import + call
│   └── script.test.ts                # MODIFY: delete the related vi.mock + 3 assertions
├── components/
│   ├── image/TriggerImageGeneration.tsx   # MODIFY: drop <Refetch>, drop shouldRefetch state
│   └── timer/refetch.tsx                  # DELETE
├── tests/
│   ├── api/
│   │   ├── trigger.$id.test.ts            # MODIFY: drop invalidatePublicContent mock + assertions
│   │   ├── log.submit.test.ts             # MODIFY: assert X-Invalidate header on success
│   │   ├── log.$id.test.ts                # MODIFY: assert X-Invalidate on PUT and DELETE
│   │   ├── log.test.ts                    # MODIFY: assert X-Invalidate on POST
│   │   └── log.$id.categories.test.ts     # MODIFY: assert X-Invalidate on POST
│   └── components/
│       ├── image/TriggerImageGeneration.test.tsx   # MODIFY: assert no <Refetch>
│       └── timer/refetch.test.tsx                   # DELETE
```

**Structure Decision**: Existing single-package layout (no monorepo). Co-located `utils/*.test.ts` matches the constitution. New test files for `http`, `fetch`, `invalidation` follow the same pattern.

---

## Phase 0 — Research / Decisions Already Made

| Decision | Choice | Rationale |
| --- | --- | --- |
| Tag mapping owner | Single predicate `matchesTags(match, tags)` in `utils/invalidation.ts` | One source of truth; tested in isolation; reusable from `fetcher`. |
| Router accessor | Module-scope ref captured inside `getRouter()` (client only) | `getRouter` is the existing entry point used by `@tanstack/react-start`. No alternative wrapper needed. |
| Tag scheme | `'logs' \| \`log:${number}\`` | Map directly to TanStack Router route ids; map 1:1 to future `Cache-Tag` values. |
| `X-Invalidate` vs `Cache-Tag` | `X-Invalidate` for now | Avoids accidentally being interpreted as a cache directive by Workers/Cloudflare; rename later if/when an edge cache lands. |
| Trigger error path | Also emits `log:${id}` | The error path mutates the row (`setLogError`), so the loader must re-run to render the `Error` status. |
| `<Refetch>` removal | Delete file + test | Confirmed via grep: only consumer was `TriggerImageGeneration`. |
| Infinite-scroll state | Out of scope | `useInfiniteScroll` keeps appended pages in memory; `router.invalidate` only re-runs loaders. Documented as known limitation. |

---

## Phase 1 — Foundation (Blocking Prerequisites)

Outputs: header support, type, predicate, router accessor, fetcher interceptor.

### 1.1 `utils/invalidation.ts` (NEW)

```ts
import type { AnyRouteMatch } from '@tanstack/react-router'

export type InvalidationTag = 'logs' | `log:${number}`

const LIST_ROUTE_IDS: ReadonlySet<string> = new Set(['/', '/explore'])

export function matchesTags(match: AnyRouteMatch, tags: readonly InvalidationTag[]): boolean {
  for (const tag of tags) {
    if (tag === 'logs' && LIST_ROUTE_IDS.has(match.routeId)) return true
    if (tag.startsWith('log:')) {
      const id = tag.slice('log:'.length)
      if (
        (match.routeId === '/$id/' || match.routeId === '/$id/edit')
        && match.params?.id === id
      ) return true
    }
  }
  return false
}
```

> Implementer note: confirm the exact `AnyRouteMatch` import path against TanStack Router 1.162.9 — the type may live in `@tanstack/router-core` or be re-exported from `@tanstack/react-router`. If unavailable as a public type, narrow to a structural type `{ routeId: string; params?: Record<string, string> }` to keep the unit testable.

### 1.2 `utils/http.ts` (MODIFY `ok`)

```ts
import type { InvalidationTag } from './invalidation'

interface OkInit {
  invalidate?: readonly InvalidationTag[]
}

export function ok<T>(body: T, init?: OkInit) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init?.invalidate?.length) {
    headers['X-Invalidate'] = init.invalidate.join(',')
  }
  return new Response(JSON.stringify(body), { status: 200, headers })
}
```

Other helpers (`badRequest`, `notFound`, etc.) are untouched.

### 1.3 `start/router.tsx` (MODIFY)

```tsx
import { type AnyRouter, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

let activeRouter: AnyRouter | undefined

export function getActiveRouter(): AnyRouter | undefined {
  return activeRouter
}

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
  if (typeof window !== 'undefined') activeRouter = router
  return router
}
```

The `typeof window !== 'undefined'` guard means the server-side `getRouter()` invocations (one per request) never overwrite the client singleton.

### 1.4 `utils/fetch.ts` (MODIFY)

Add an interceptor that runs after every successful fetch:

```ts
import type { AnyRouteMatch } from '@tanstack/react-router'
import { getActiveRouter } from '@/start/router'
import { type InvalidationTag, matchesTags } from './invalidation'
import { logger } from './logger'

async function applyInvalidation(response: Response): Promise<void> {
  const raw = response.headers.get('X-Invalidate')
  if (!raw) return
  const tags = raw.split(',').map((t) => t.trim()).filter(Boolean) as InvalidationTag[]
  if (tags.length === 0) return
  const router = getActiveRouter()
  if (!router) return
  try {
    await router.invalidate({ filter: (match: AnyRouteMatch) => matchesTags(match, tags) })
  } catch (error) {
    logger.error('Failed to apply X-Invalidate:', error)
  }
}
```

Wired into the existing `fetcher` such that it runs after a successful response and before returning the parsed JSON to the caller. The clone() trick is unnecessary because we only inspect headers, not the body.

---

## Phase 2 — Tag Mutation Routes

Each route handler keeps its existing logic; the only change is the `ok(...)` invocation gains `{ invalidate: [...] }` on success paths. Tags follow FR-006:

| Route | Method | Success tags |
| --- | --- | --- |
| `/api/log/submit` | POST | `['logs', \`log:${newLog.id}\`]` |
| `/api/log/$id` | PUT | `['logs', \`log:${id}\`]` |
| `/api/log/$id` | DELETE | `['logs', \`log:${id}\`]` |
| `/api/log` (legacy) | POST | `['logs']` |
| `/api/log/$id/categories` | POST | `['logs', \`log:${logId}\`]` |
| `/api/trigger/$id` | POST (success + caught error) | `[\`log:${logId}\`]` |

Validation-failure responses (`success: false, errors: ...`) do NOT emit invalidation (no row was mutated).

---

## Phase 3 — Drop `<Refetch>` Polling

- `components/image/TriggerImageGeneration.tsx`: delete `shouldRefetch` state, remove `<Refetch>` from JSX. The component still calls `triggerGeneration({ params: { id: log.id } })` once on mount; the response now carries `X-Invalidate: log:N`, the fetcher interceptor runs `router.invalidate({ filter })`, and `/$id/`'s loader re-runs. Component returns `null`.
- `components/timer/refetch.tsx`: delete file.
- `tests/components/timer/refetch.test.tsx`: delete file.
- `tests/components/image/TriggerImageGeneration.test.tsx`: update — assert `<Refetch>` is not rendered.

---

## Phase 4 — Delete `invalidatePublicContent`

- `services/content.ts`: remove the `invalidatePublicContent` export and the `await invalidatePublicContent()` line inside `regenerateContents`. Keep `regenerateContents` itself (still drives `triggerLogImageIfPending` etc.).
- `services/script.ts`: remove the import and the `if (logs.length > 0) await invalidatePublicContent()` block.
- `start/routes/api/trigger/$id.ts`: remove the import and the `await invalidatePublicContent()` line.
- Tests (per FR-012): delete the `describe('invalidatePublicContent', ...)` block from `services/content.test.ts`; delete the `vi.mock('@/services/content', ...)` and 3 `expect(invalidatePublicContent)…` assertions from `services/script.test.ts`; delete the `vi.mock` and 2 assertions from `tests/api/trigger.$id.test.ts`.

After this phase, `rg invalidatePublicContent` returns zero hits.

---

## Verification (Quickstart)

```bash
# from .worktrees/004-x-invalidate
pnpm install               # noop if lockfile unchanged
pnpm lint                  # zero errors
pnpm typecheck             # tsc --noEmit -p tsconfig.build.json
pnpm test:coverage         # all green; ≥50/50 thresholds
pnpm build                 # production build OK
pnpm cf-typegen            # no diff vs committed worker-configuration.d.ts

# Manual smoke
pnpm dev
# - Submit /new → see new entry on /
# - Edit /$id/edit → see updated /$id without refresh
# - Delete via PUT/DELETE in DevTools → row gone from /explore
# - Open a fresh /$id (status Created) → image appears without polling
```

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `AnyRouteMatch` type not exported under that exact name | Medium | Fall back to a structural shape `{ routeId: string; params?: Record<string,string> }` in `matchesTags` signature. Caught at typecheck. |
| `getActiveRouter()` returns `undefined` post-hydration | Low | Capture inside `getRouter()` which is the framework's required entry. If TanStack Start changes that contract, add a one-line `setActiveRouter(router)` call from the client entry point. |
| Cross-tab edits not reflected | Known, accepted | Documented in spec.md as out of scope. |
| Infinite-scroll appended pages stale | Known, accepted | Documented in spec.md. Backlog. |
| Some mutation route slips by un-tagged | Low | One-time grep `rg "ok<.*>" start/routes/api` review during PR; review subagent (`/gh-pr-no-checkout-review`) catches it. |

---

## Order Of Operations

1. Phase 1 (Foundation): ship the type, predicate, header support, router accessor, fetcher interceptor — gated by green unit tests. Mutation routes are not yet tagged, so behaviour is unchanged.
2. Phase 2 (Tag routes): one PR-style commit per group (logs CRUD, trigger). Each commit ships with a route-level test asserting the header.
3. Phase 3 (Drop polling): single commit; tests for `TriggerImageGeneration` updated; `refetch.tsx` deleted.
4. Phase 4 (Delete the lie): single commit; `rg invalidatePublicContent` returns zero.

Each commit message will follow Conventional Commits per repo convention.
