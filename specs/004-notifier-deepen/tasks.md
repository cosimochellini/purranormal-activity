---
description: "Task list for deepening Telegram notification behind a Notifier"
---

# Tasks: Deepen Telegram Notification Behind a `Notifier`

**Input**: Design documents from `/specs/004-notifier-deepen/`
**Prerequisites**: plan.md, spec.md.

**Tests**: New tests are authored alongside the new modules (notifier
boundary tests; primitive HTTP-shape tests). Legacy tests for
`services/notification.ts` are deleted in Phase 5.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no shared dependency.
- **[Story]**: Maps task to user story (US1, US2, US3, US4).

## Path Conventions

Single-project layout. Repo root:
`/Users/cosimochellini/Documents/projects/purranormal-activity/`. Work
happens in worktree `.worktrees/004-notifier-deepen/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create branch + worktree: `git worktree add -b 004-notifier-deepen .worktrees/004-notifier-deepen origin/main`.
- [ ] T002 Install deps in worktree: `pnpm install --frozen-lockfile`.
- [ ] T003 Capture baseline: `pnpm test` count + `pnpm test:coverage` percentages — record locally for the PR description.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared types/interfaces that downstream modules consume.

- [ ] T004 [US3] Add `export interface Logger` to `utils/logger.ts`; annotate the existing `logger` export `: Logger`. No behaviour change.
- [ ] T005 [US3] Add `export interface ChatResult { success; messageId?; error? }` to `services/telegram/types.ts`.

**Checkpoint**: typecheck still green; legacy callers unchanged.

---

## Phase 3: User Story 3 — Single-Chat Primitives (Priority: P2)

**Goal**: `services/telegram/index.ts` exposes only single-chat primitives.

**Independent Test**: Grep `services/telegram/**` for `TELEGRAM_BOT_CHAT_IDS` returns zero matches.

- [ ] T006 [US3] Rewrite `services/telegram/index.ts`: replace multi-chat `sendMessage`/`sendPhoto` with single-chat versions taking `(chatId, body|photoUrl, opts?)`. Each does one HTTP call and returns `ChatResult`. Default `parseMode` is `'HTML'` for `sendMessage` and `'MarkdownV2'` for `sendPhoto`.
- [ ] T007 [US3] Update `services/telegram/types.ts`: drop `chatIds` from `SendMessageOptions` and `SendPhotoOptions`; replace `SendMessageInput`/`SendMessageResult`/`SendPhotoInput`/`SendPhotoResult` with the slimmer single-chat shape (or remove if no longer referenced).
- [ ] T008 [US3] [P] Add `services/telegram/index.test.ts` covering: text happy path, text API error (`ok:false`), text fetch throw, photo happy path with `parse_mode:'MarkdownV2'`, custom `parseMode` override, `chatId` is `.trim()`-ed before send.
- [ ] T009 Adapt `services/notification.ts` to the new primitive signatures by wrapping single-chat calls in a small fan-out shim. Goal: keep the shim equivalent to today's behaviour so the route + tests stay green between Phases 3 and 4. (This shim disappears in Phase 5.)

**Checkpoint**: `pnpm typecheck && pnpm test && pnpm build` green; route response unchanged.

---

## Phase 4: User Story 1 + User Story 2 — Notifier Module (Priority: P1)

**Goal**: New `services/notifier/` owns fan-out and partial-success accounting; image URL comes from `resolveImageUrl(id)` (defaults to `publicImage`).

**Independent Test**: Grep for `pub-9cd2e6644bc8418a87242879f6146869` returns zero matches outside `tests/` (and even there, only as a negative-assertion reference).

- [ ] T010 [US1] [US2] Add `services/notifier/index.ts` exporting `NotifyOutcome`, `Notifier`, `NotifierDeps`, `createNotifier(deps?)`, and a default `notifier`. Algorithm per plan.md "Fan-Out Algorithm". Defaults inside `createNotifier` (lazy env reads): `chatIds = TELEGRAM_BOT_CHAT_IDS`, `sendMessage = telegramSendMessage`, `sendPhoto = telegramSendPhoto`, `composeMessage = generateTelegramMessage`, `resolveImageUrl = publicImage`, `logger = utils/logger.logger`.
- [ ] T011 [US1] [US2] [P] Add `services/notifier/notifier.test.ts` covering all 10 cases listed in plan.md "Test Plan" — empty chats, all success, photo fail one chat, text fail one chat, all text fail, single compose call, single resolveImageUrl call, no hardcoded R2 host, primitive throws isolation, logger calls.
- [ ] T012 Replace the body of `services/notification.ts` with a 3-line shim that calls `notifier.notify(event)` and adapts the outcome to legacy `SendEventNotificationResult` (success when delivered; otherwise pass through error string). Keeps existing tests + route green during transition.

**Checkpoint**: `pnpm typecheck && pnpm test && pnpm build` green; route response unchanged.

---

## Phase 5: Cut Over the Route + Type + Test (Priority: P1)

**Goal**: `start/routes/api/telegram/$id.ts` consumes `notifier.notify` directly. The optional `partial` field surfaces in `TelegramIdResponse`.

- [ ] T013 [US2] Modify `types/api/telegram-id.ts`: add optional `partial?: { reachedChats; totalChats; failedPhotoChats }` to the failure arm.
- [ ] T014 [US2] Modify `start/routes/api/telegram/$id.ts`: import `notifier` from `@/services/notifier`; map outcome → response per plan.md "Route → response mapping".
- [ ] T015 [US2] Rewrite `tests/api/telegram.$id.test.ts`: mock `@/services/notifier` (not `@/services/notification`). Cover: invalid id, missing log, delivered, partial-photo failure, all-fail, throw.

**Checkpoint**: All tests green; partial-failure response shape matches the spec example.

---

## Phase 6: Delete Legacy (Priority: P1)

**Goal**: Remove the deprecated module + dead types. Coverage holds.

- [ ] T016 Delete `services/notification.ts`.
- [ ] T017 Delete `services/notification.test.ts`.
- [ ] T018 Delete `SendEventNotificationResult` and any other types in `services/telegram/types.ts` whose only consumer was `services/notification.ts`.
- [ ] T019 Verify no source file imports `@/services/notification`: `grep -rn "@/services/notification" .` returns zero.

**Checkpoint**: `pnpm typecheck && pnpm test:coverage && pnpm build && pnpm cf-typegen` all green; coverage ≥50% lines AND ≥50% branches.

---

## Phase 7: Quality Gate (Priority: P3)

- [ ] T020 [US4] Push branch: `git push -u origin 004-notifier-deepen`.
- [ ] T021 [US4] Open PR with title `RFC #9: deepen Telegram notifier behind Notifier` and a body that links the issue + lists the four commits + acceptance evidence (grep results, test counts).
- [ ] T022 [US4] Run `/gh-pr-no-checkout-review <PR-URL>` from a fresh session. Address every P0/P1/P2 finding. Push fixes; re-run. Iterate until the report is clean. No iteration cap.

---

## Dependency Graph

```
T001 → T002 → T003
                ├→ T004 ─┐
                └→ T005 ─┤
                         ├→ T006 → T007 → T008 ─┐
                         │                       ├→ T009 ─┐
                         └─────────────────────────┘      ├→ T010 → T011 ─┐
                                                          └────────────────┤→ T012 ─┐
                                                                                    ├→ T013 → T014 → T015 ─┐
                                                                                                            ├→ T016 → T017 → T018 → T019 ─┐
                                                                                                                                          ├→ T020 → T021 → T022
```

[P] tasks (T008, T011) are file-isolated and can be authored in parallel
with their sibling refactors but commit alongside them.

## Acceptance Snapshot

- All four user stories have an independent test (per spec.md).
- Coverage gate (`≥50% / ≥50%`) holds.
- Zero P0/P1/P2 from `/gh-pr-no-checkout-review` on the final iteration.
