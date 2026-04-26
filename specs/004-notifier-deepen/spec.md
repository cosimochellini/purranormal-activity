# Feature Specification: Deepen Telegram Notification Behind a `Notifier`

**Feature Branch**: `004-notifier-deepen`
**Created**: 2026-04-26
**Status**: Draft
**Input**: GitHub Issue #9 — "RFC: Deepen Telegram notification module behind a Notifier".

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Image URL Stops Bypassing Env Config (Priority: P1)

As the maintainer, when I rotate the Cloudflare R2 public hostname, I need
the Telegram notification card to follow the new hostname automatically, so
the bucket migration is a one-line env change instead of a code patch.

**Why this priority**: Today `services/notification.ts:30` hardcodes
`https://pub-9cd2e6644bc8418a87242879f6146869.r2.dev/...`. That literal
ignores both `VITE_CLOUDFLARE_PUBLIC_URL` and the existing `publicImage(id)`
helper at `utils/public-image.ts`. A bucket rotation today silently breaks
every Telegram card until a code patch ships.

**Independent Test**: With `VITE_CLOUDFLARE_PUBLIC_URL=images.example.test`,
trigger `POST /api/telegram/$id` for a known event id; the outbound
`sendPhoto` payload's `photo` field is
`https://images.example.test/<id>/cover.webp`. The literal
`pub-9cd2e6644bc8418a87242879f6146869.r2.dev` appears in **zero** files
under `services/`, `start/`, `components/`.

**Acceptance Scenarios**:

1. **Given** an event id 42 and `VITE_CLOUDFLARE_PUBLIC_URL=images.example.test`,
   **When** the route is called, **Then** the outbound `photo` URL is
   `https://images.example.test/42/cover.webp`.
2. **Given** `VITE_CLOUDFLARE_PUBLIC_URL` unset, **When** the route is
   called, **Then** the resolver returns `''` (matching `publicImage`
   semantics) and the failure surfaces through the regular outcome path —
   no module-load crash.
3. **Given** a code search for the hardcoded R2 hostname literal, **When**
   the search runs, **Then** zero matches outside `tests/**` (a single
   negative-assertion test reference is allowed).

---

### User Story 2 — Callers Can Distinguish Partial From Total Failure (Priority: P1)

As an operator, when a Telegram fan-out partially succeeds (e.g., text
delivered to chat A but photo failed on chat B), I need the API response to
report which chats lost the photo, so a follow-up retry can target only
the missing piece instead of resending the whole notification.

**Why this priority**: `services/telegram/index.ts` runs independent
per-chat loops for `sendMessage` and `sendPhoto`, swallows per-chat
failures, and collapses the result to a top-level `{success: false}`. The
single-bool return loses both *which* chats failed and *what* asset failed.
Without that, retry is "resend everything to everyone" — duplicate text on
the chats that already got it.

**Independent Test**: Mock the per-chat primitives so chat `c1`'s photo
fails and chat `c2`'s text+photo both succeed. The route response is:

```json
{ "success": false, "error": "Telegram fan-out partial",
  "partial": { "reachedChats": 2, "totalChats": 2,
               "failedPhotoChats": ["c1"] } }
```

**Acceptance Scenarios**:

1. **Given** every chat receives both message and photo, **When** the
   notifier returns, **Then** `delivered === true`, `reachedChats ===
   totalChats`, `failedPhotoChats === []`.
2. **Given** one chat's photo fails after its text succeeded, **When** the
   notifier returns, **Then** `delivered === false`,
   `reachedChats === totalChats`, `failedPhotoChats === ['<that chat>']`.
3. **Given** one chat's text fails, **When** the notifier returns, **Then**
   `delivered === false`, `reachedChats < totalChats`, **photo is never
   attempted on that chat** (the failing chat does NOT appear in
   `failedPhotoChats`).
4. **Given** every chat's text fails, **When** the notifier returns,
   **Then** `delivered === false`, `reachedChats === 0`,
   `failedPhotoChats === []`, `messageId === undefined`.
5. **Given** the configured `chatIds` list is empty, **When** the notifier
   is called, **Then** it returns `{delivered:false, reachedChats:0,
   totalChats:0, failedPhotoChats:[]}` and **never** invokes
   `composeMessage` or any HTTP primitive.
6. **Given** one chat's `sendMessage` throws (network error escapes the
   primitive), **When** the notifier returns, **Then** that chat ends up
   `textOk:false` and the other chats' work is unaffected.

---

### User Story 3 — Telegram Service Becomes Single-Chat Primitives (Priority: P2)

As a future maintainer, when I add a second notification channel (Slack,
email, etc.), I need the Telegram module to expose **single-chat**
primitives so the multi-recipient logic is owned by the channel-agnostic
`Notifier` and not duplicated per channel.

**Why this priority**: P2 because P1 stories deliver the user-visible
fixes; this story is the **architectural** lever that makes future channels
cheap. Without it, the multi-recipient loop will be re-invented in the next
channel.

**Independent Test**: `services/telegram/index.ts` exports
`sendMessage(chatId, body, opts?)` and `sendPhoto(chatId, photoUrl, opts?)`
— neither reads `TELEGRAM_BOT_CHAT_IDS`. A grep for `for (const chatId of`
in `services/telegram/**` returns zero hits.

**Acceptance Scenarios**:

1. **Given** the refactor merged, **When** a contributor greps
   `services/telegram/` for `TELEGRAM_BOT_CHAT_IDS`, **Then** there are
   zero matches (env consumption moved to the notifier's default deps).
2. **Given** a unit test mocks the global `fetch`, **When** it calls
   `sendMessage('123', 'hi')`, **Then** exactly one HTTP request fires with
   `chat_id: '123'`, `text: 'hi'`, `parse_mode: 'HTML'`.
3. **Given** a unit test calls `sendPhoto('123', 'https://x/y.webp')`,
   **Then** exactly one HTTP request fires with `parse_mode: 'MarkdownV2'`
   by default (preserving the production payload that previously came from
   `services/notification.ts`'s explicit override).

---

### User Story 4 — `/gh-pr-no-checkout-review` Reports Zero P0/P1/P2 (Priority: P3)

As the maintainer, before merging, I need an independent zero-context
review agent to confirm the PR introduces no new P0/P1/P2 findings, so the
refactor lands without hidden regressions.

**Why this priority**: P3 because Stories 1–3 deliver the value; this story
is the **quality gate**. The agent is a second opinion, not a substitute
for tests.

**Independent Test**: Run `/gh-pr-no-checkout-review <PR-URL>` from a fresh
session. The output reports zero P0, zero P1, and zero P2 findings.

**Acceptance Scenarios**:

1. **Given** the PR is open and CI is green, **When**
   `/gh-pr-no-checkout-review` runs, **Then** it reports zero P0/P1/P2
   findings (P3 noise is acceptable).
2. **Given** the agent reports issues, **When** the maintainer fixes them
   and re-runs, **Then** subsequent iterations converge to a clean report.
   No iteration cap.

### Edge Cases

- `composeMessage` (default `services/ai.ts:generateTelegramMessage`)
  rejects → propagates from `notifier.notify`; the route's outer
  `try/catch` maps it to `{success:false, error}`. Equivalent to today's
  `notification.ts` outer catch.
- `resolveImageUrl` returns `''` (env unset) → `sendPhoto` receives `''`;
  the Telegram API rejects; the chat ends in `failedPhotoChats`.
  Documents the env-unset failure mode through the same partial-failure
  channel as any other photo failure.
- Default singleton `notifier` is imported at module-load time by
  `start/routes/api/telegram/$id.ts`; **default deps are computed lazily
  inside `createNotifier`** so test files that pass full `deps` never
  trigger env reads.
- `Promise.all` parallelism — one chat's primitive throwing does NOT
  reject the whole fan-out; each chat's work is wrapped in its own
  `try/catch` (see plan.md "Fan-Out Algorithm").
- Backward compat for `TelegramIdResponse`: the `partial` field is
  **optional** on the failure arm only; existing consumers
  (`components/common/SendNotificationButton.tsx`) read `success`,
  `messageId`, `error` — no UI change required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A `Notifier` interface with `notify(event:
  LogWithCategories): Promise<NotifyOutcome>` MUST exist at
  `services/notifier/index.ts`. `NotifyOutcome` carries `delivered`,
  `reachedChats`, `totalChats`, `failedPhotoChats`, and a best-effort
  `messageId`.
- **FR-002**: A factory `createNotifier(deps?: Partial<NotifierDeps>):
  Notifier` MUST exist. `NotifierDeps` lists `chatIds`, `sendMessage`,
  `sendPhoto`, `composeMessage`, `resolveImageUrl`, `logger`. A default
  singleton `notifier` MUST be exported.
- **FR-003**: `services/telegram/index.ts` MUST expose only single-chat
  primitives `sendMessage(chatId, body, opts?)` and
  `sendPhoto(chatId, photoUrl, opts?)`. Multi-chat fan-out MUST be
  removed.
- **FR-004**: `Notifier.notify` MUST resolve `composeMessage` once per
  call and `resolveImageUrl(event.id)` once per call. The same text and
  photo URL MUST be sent to every chat in the fan-out.
- **FR-005**: For an empty `chatIds`, `notify` MUST return `{delivered:
  false, reachedChats:0, totalChats:0, failedPhotoChats:[]}` without
  calling `composeMessage`, `sendMessage`, or `sendPhoto`.
- **FR-006**: A chat whose text fails MUST NOT have its photo attempted;
  it MUST NOT appear in `failedPhotoChats`. A chat whose text succeeds
  AND photo fails MUST appear in `failedPhotoChats`.
- **FR-007**: The image URL passed to `sendPhoto` MUST come from
  `resolveImageUrl`. The literal string
  `pub-9cd2e6644bc8418a87242879f6146869.r2.dev` MUST NOT appear in any
  source file under `services/`, `start/`, `components/`, `utils/`,
  `db/`, `env/`, `hooks/`, or `app/`.
- **FR-008**: `start/routes/api/telegram/$id.ts` MUST consume
  `notifier.notify` and map the outcome to `TelegramIdResponse`:
  `delivered → success:true`; otherwise `success:false` with
  `error: 'Telegram fan-out failed'` (when `reachedChats === 0`) or
  `error: 'Telegram fan-out partial'` (otherwise), plus an optional
  `partial: { reachedChats, totalChats, failedPhotoChats }`.
- **FR-009**: `services/notification.ts` and
  `services/notification.test.ts` MUST be deleted. Any types in
  `services/telegram/types.ts` whose only consumer was the legacy module
  (e.g., `SendEventNotificationResult`) MUST be deleted.
- **FR-010**: `utils/logger.ts` MUST export an `interface Logger` whose
  shape matches the existing `logger` object. The existing `logger`
  export MUST be annotated `: Logger`.
- **FR-011**: All new tests MUST be deterministic and MUST NOT call real
  networks (no real Telegram API). Boundary mocking is enforced via
  `vi.mock` on `@/services/telegram` (in notifier tests) and on the
  global `fetch` (in primitive tests, via `tests/helpers.ts`).
- **FR-012**: Coverage MUST stay ≥50% lines AND ≥50% branches
  (constitution Principle I).

### Non-Functional Requirements

- **NFR-001**: Each commit on the branch MUST end with `pnpm typecheck &&
  pnpm lint && pnpm test && pnpm build` green. No "fix later" commits.
- **NFR-002**: The PR MUST converge to zero P0/P1/P2 findings from
  `/gh-pr-no-checkout-review`. No cap on iterations.
- **NFR-003**: No new runtime dependency MUST be introduced. The refactor
  is pure rearrangement.

## Success Criteria

- **SC-001**: `pnpm test:coverage` passes with ≥50% lines AND ≥50%
  branches; total test count ≥ baseline (272) at PR head.
- **SC-002**: Grep over `services/`, `start/`, `components/`, `utils/`,
  `db/`, `env/`, `hooks/`, `app/` for the literal
  `pub-9cd2e6644bc8418a87242879f6146869` returns zero matches.
- **SC-003**: Grep over `services/telegram/**` for
  `TELEGRAM_BOT_CHAT_IDS` returns zero matches.
- **SC-004**: `services/notification.ts` and `services/notification.test.ts`
  do not exist at PR head.
- **SC-005**: `pnpm build` and `pnpm cf-typegen` (no diff) both succeed.
- **SC-006**: `/gh-pr-no-checkout-review <PR-URL>` returns zero P0/P1/P2
  on the final iteration.
