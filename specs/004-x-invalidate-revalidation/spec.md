# Feature Specification: Delete cache no-op, ship `X-Invalidate` revalidation

**Feature Branch**: `004-x-invalidate-revalidation`
**Created**: 2026-04-26
**Status**: Draft
**Input**: GitHub Issue #8 — "RFC: Delete cache no-op and ship X-Invalidate revalidation"
**Source**: <https://github.com/cosimochellini/purranormal-activity/issues/8>

---

## Problem Statement

Two cohabitating defects hurt the codebase:

1. `services/content.ts::invalidatePublicContent` is a *literal no-op* (`logger.info` only). Three call sites pretend cache invalidation happens after mutations:
   - `services/content.ts:37` (inside `regenerateContents`)
   - `services/script.ts:40` (after batch image generation)
   - `start/routes/api/trigger/$id.ts:24` (after image generation finishes)

   `wrangler.jsonc` declares no KV / Cache / Durable Object, and CLAUDE.md confirms `Cache strategy: fresh SSR / no-store on Workers; advanced edge caching is deferred backlog.` There is *literally nothing to invalidate*. The function is a comforting lie that wastes reviewer attention.

2. `components/image/TriggerImageGeneration.tsx` polls (`<Refetch>` after a delay) because the client doesn't know when the server finished generating an image. After mutations, `/explore` and `/$id` don't reflect new state until the user manually refreshes.

The combined symptom: users (and code reviewers) believe a cache layer exists; meanwhile the UI uses ad-hoc polling to compensate for the missing reactive layer.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Submit a log and immediately see it in the list (Priority: P1) 🎯 MVP

A visitor submits a new paranormal event at `/new`. After the success response, navigating (or being redirected) to `/` or `/explore` shows the new entry without a manual refresh.

**Why this priority**: This is the central content-creation flow. Without it, the app feels broken after the very first user action.

**Independent Test**: Submit a valid log via the `/new` form; programmatically navigate to `/` and assert the new title appears in the rendered list, without `location.reload`.

**Acceptance Scenarios**:

1. **Given** a clean `/explore` listing, **When** I submit a new log, **Then** the entry appears in the list within one navigation, no refresh needed.
2. **Given** the home page is open in tab A, **When** I submit a log in tab B and return to tab A, **Then** a focus-driven loader re-run pulls the new entry (acceptable: TanStack Router default loader staleness behaviour).

### User Story 2 — Edit a log and see updated fields without refresh (Priority: P1)

An author edits a log at `/$id/edit` and saves. Returning to `/$id` shows updated title/description/categories without a refresh.

**Why this priority**: Same content-creation flow as US1 from the editing side. Same severity.

**Independent Test**: PUT a payload to `/api/log/{id}` and verify the response includes `X-Invalidate: logs,log:{id}`. In the UI: edit a log, navigate to `/$id`, assert the rendered DOM matches the new values.

**Acceptance Scenarios**:

1. **Given** I am on `/$id/edit`, **When** I save valid changes, **Then** `/$id` and `/explore` both reflect the new content on the next render.
2. **Given** I rename only the title, **When** I save, **Then** the image is NOT regenerated (status remains `ImageGenerated`).

### User Story 3 — Image generation completes without polling (Priority: P1)

A new log lands on `/$id` with status `Created`. The page triggers `/api/trigger/$id`. When the server finishes, the page rerenders with the freshly generated image. No `setTimeout`-driven refetch loop.

**Why this priority**: Removes the existing polling component (`<Refetch>`). The interactive perception of "new image appeared" is the whole point of the feature.

**Independent Test**: Mount `TriggerImageGeneration` with a `Created`-status log; mock `fetcher` to return a response with `X-Invalidate: log:N`; assert `router.invalidate` is called with a filter that matches `/$id/`. Assert `<Refetch>` is no longer rendered.

**Acceptance Scenarios**:

1. **Given** a fresh log, **When** I land on its detail page, **Then** the trigger fires once and the page rerenders with the generated image once the server finishes.
2. **Given** the trigger response carries `X-Invalidate: log:7`, **When** the fetcher resolves, **Then** the matching loader re-runs exactly once.

### User Story 4 — Delete a log and see it removed from listings (Priority: P2)

An admin deletes a log; `/explore` listing reflects the removal on next render.

**Independent Test**: DELETE `/api/log/{id}` and assert response carries `X-Invalidate: logs,log:{id}`.

**Acceptance Scenarios**:

1. **Given** a log id 7 exists, **When** I send DELETE with the secret, **Then** the response status is 200 and the header is set; the home loader no longer returns id 7.

### User Story 5 — Codebase honesty (Priority: P2)

The `invalidatePublicContent` placeholder and its three call sites are gone from production code and tests. Future maintainers do not waste cycles auditing a function that does nothing.

**Independent Test**: `rg "invalidatePublicContent"` returns zero hits.

**Acceptance Scenarios**:

1. **Given** the merge has landed, **When** I run `rg invalidatePublicContent`, **Then** zero matches are found across `services/`, `start/`, `tests/`, `components/`.
2. **Given** the merge has landed, **When** I open `components/timer/refetch.tsx`, **Then** the file does not exist.

### Edge Cases

- **Server-side fetcher**: when `fetcher` runs during SSR/loader execution there is no client router; the interceptor must short-circuit silently (no logged error).
- **Trigger error path**: when `/api/trigger/$id` catches an error and writes `setLogError`, the response is still `200 ok` with `success: false`. The row was mutated, so the response MUST still emit `X-Invalidate: log:{id}` so the page can re-render the error badge.
- **Empty `invalidate` array**: passing `invalidate: []` MUST NOT emit the `X-Invalidate` header (no zero-length tag value).
- **Unknown tag**: `matchesTags` ignores tags it doesn't know about — no throw, no warn (forward-compat for future tag classes).
- **Multi-tab**: TanStack Router only revalidates within the current document; cross-tab is out of scope (acceptable for v1).
- **Infinite-scroll on `/` and `/explore`**: client-fetched pages 2+ are not auto-refreshed by `router.invalidate`; only the initial loader payload re-runs. Documented in Assumptions; deferred to backlog.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `utils/http.ts::ok` MUST accept an optional `{ invalidate?: InvalidationTag[] }` argument and emit a single `X-Invalidate` response header containing the comma-joined tags.
- **FR-002**: When `invalidate` is omitted or empty, `ok` MUST NOT emit the `X-Invalidate` header.
- **FR-003**: `utils/fetch.ts::fetcher`, on receiving any successful response carrying `X-Invalidate`, MUST parse the header into a tag list and call `router.invalidate({ filter })` against the live client router.
- **FR-004**: When no client router is available (server-side / pre-hydration), `fetcher` MUST silently skip invalidation.
- **FR-005**: A typed predicate `matchesTags(match, tags)` MUST map known tag patterns to TanStack Router route ids:
  - `logs` → `/`, `/explore`
  - `log:${N}` → `/$id/` and `/$id/edit` when `match.params.id === String(N)`
- **FR-006**: The following mutation route handlers MUST emit the listed tags on their primary success response:
  - `POST /api/log/submit` → `logs`, `log:${newLog.id}`
  - `PUT  /api/log/$id`     → `logs`, `log:${id}`
  - `DELETE /api/log/$id`   → `logs`, `log:${id}`
  - `POST /api/log` (legacy) → `logs`
  - `POST /api/log/$id/categories` → `logs`, `log:${logId}`
  - `POST /api/trigger/$id` → `log:${id}` (success AND caught-error responses, since the row was mutated either way)
- **FR-007**: `services/content.ts::invalidatePublicContent` MUST be deleted, including its single call inside `regenerateContents`.
- **FR-008**: All three production call sites of `invalidatePublicContent` MUST be removed:
  - `services/content.ts:37` (inside `regenerateContents`)
  - `services/script.ts:40` (after batch loop)
  - `start/routes/api/trigger/$id.ts:24` (after generation)
- **FR-009**: `components/image/TriggerImageGeneration.tsx` MUST no longer render `<Refetch>` and MUST no longer track a `shouldRefetch` state.
- **FR-010**: `components/timer/refetch.tsx` MUST be deleted (no other consumer).
- **FR-011**: `tests/components/timer/refetch.test.tsx` MUST be deleted.
- **FR-012**: Tests asserting `invalidatePublicContent` was called MUST be removed:
  - `services/content.test.ts` — the `describe('invalidatePublicContent', …)` block.
  - `services/script.test.ts` — the `vi.mock('@/services/content', …)` and three `expect(invalidatePublicContent)…` assertions.
  - `tests/api/trigger.$id.test.ts` — the `vi.mock` and two `expect(invalidatePublicContent)…` assertions.
- **FR-013**: New tests MUST cover:
  - `ok` emits / omits the header per FR-001/FR-002.
  - `matchesTags` truth table for `logs` and `log:N` against `/`, `/explore`, `/$id/` (with and without matching `params.id`), `/$id/edit`, and unknown route ids.
  - `fetcher` calls `router.invalidate` with the expected filter when the response carries `X-Invalidate`; does NOT call when header is absent; silently no-ops when no router is set.
  - Each mutation route's success response includes the documented `X-Invalidate` value (one assertion per route).
  - `TriggerImageGeneration` no longer renders `<Refetch>` (regression guard).
- **FR-014**: All Constitution v1.0.0 quality gates MUST pass: `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (≥50% lines AND ≥50% branches), `pnpm build`, `pnpm cf-typegen` (no diff).

### Key Entities

- **InvalidationTag** *(new type)*: discriminated string literal — `'logs' | \`log:${number}\``. Lives in `utils/invalidation.ts`.
- **`X-Invalidate` header**: comma-separated list of `InvalidationTag` values. Single source of truth for which loaders should re-run after a mutation.
- **TanStack Router match predicate**: `(match: AnyRouteMatch, tags: InvalidationTag[]) => boolean`. Closes the loop between server-side mutations and client-side loaders.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a `/new` submit, the new log is visible on `/` within one client-side navigation, with no `window.location.reload` call (asserted in component-level test).
- **SC-002**: Image generation completion no longer relies on a polling timer. Search for `<Refetch>` JSX returns zero hits.
- **SC-003**: `rg "invalidatePublicContent"` returns zero hits across the entire repo.
- **SC-004**: All mutation routes listed in FR-006 emit the documented `X-Invalidate` header (one passing test per route).
- **SC-005**: Test count delta is non-negative (we delete some tests but add more): baseline 272 → ≥272 after merge.
- **SC-006**: `pnpm test:coverage` reports ≥50% lines AND ≥50% branches per Constitution §I.
- **SC-007**: `/gh-pr-no-checkout-review` reports zero P0/P1/P2 findings on three consecutive runs.

---

## Assumptions

- All client mutation calls in this codebase route through `utils/fetch.ts::fetcher`. Raw `fetch()` calls and `createServerFn` calls bypass the interceptor — acceptable today; a follow-up may broaden coverage if a contributor adds a non-`fetcher` call.
- `TanStack Router` `router.invalidate({ filter })` is stable and accepts a per-match predicate. Documented in TanStack Router docs and confirmed by the existing `components/timer/refetch.tsx:21` usage.
- A single-process client router singleton is acceptable. We capture it inside the existing `getRouter` factory in `start/router.tsx`.
- Server-side `fetcher` invocations during SSR do not need to invalidate anything — the loader is the source of truth for that render.
- Infinite-scroll appended pages on `/` and `/explore` are NOT in scope. They will be handled by a follow-up if user feedback requires it. Documented in PR body.
- The `X-Invalidate` header maps cleanly onto `Cache-Tag` / `CDN-Cache-Control: tag=` if/when an edge cache lands. No naming conflict.
- `useQueryState` (nuqs) URL state remains the source of truth for `/explore` filters; invalidation does not touch it.

---

## Out of Scope (Deferred)

- Edge cache layer (KV / Cache API / Durable Objects).
- Cross-tab invalidation (BroadcastChannel / storage events).
- Refresh of in-memory infinite-scroll state on `/` and `/explore`.
- Replacing `createServerFn` calls with `fetcher` (mixed surfaces remain).
