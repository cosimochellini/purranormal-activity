# Phase 0 Research: StoryForge Module Consolidation

All open questions were resolved interactively in the planning conversation prior to this speckit invocation. The decisions and rejected alternatives are recorded here for future readers.

## Decision: Worktree mode — single sequential

**Choice**: Single worktree at `.worktrees/005-storyforge-consolidation`. Subagents only for parallel research/review (not parallel writes).

**Rationale**: Sub-task scope is small (~6 new files, ~6 deletions, 4 caller edits). Parallel writes across worktrees would invite merge conflicts on shared files (`services/notifier/index.ts`, `tests/helpers.ts`) for negligible time savings.

**Alternatives rejected**:
- Multiple worktrees, parallel implementation — higher conflict risk, no scheduling win.
- Single worktree, parallel research only — equivalent outcome; chose this.

## Decision: Placement of `generateImageBase64`

**Choice**: Move to `services/imageGen.ts`. Keep its current `throw on failure` contract.

**Rationale**: It's not prompt-driven (takes a raw prompt string, not a description), so the issue spec excludes it from the StoryForge interface. Leaving it in `services/ai.ts` would mean retaining a one-function file just for a unique residual; promoting it to its own module gives a cleaner final layout.

**Alternatives rejected**:
- Keep in `services/ai.ts` — keeps a vestigial single-function file.
- Add as 5th StoryForge method — diverges from the issue spec; pollutes the prompt-driven surface with a thin pass-through.

## Decision: Migration cadence

**Choice**: Big-bang in one PR. All 4 callers migrate together, all three superseded files delete in the same commit.

**Rationale**: Only 4 caller sites. Bridge migration would require keeping `services/ai.ts` as a re-export shim — additional surface to test, harder to type-narrow with AIResult.

**Alternatives rejected**:
- Bridge then migrate (issue spec text suggests this) — slower, adds a deprecated surface to the codebase that wouldn't fall off until a follow-up PR.

## Decision: Spec-kit pipeline depth

**Choice**: Full pipeline (specify → clarify → plan → tasks → analyze → implement).

**Rationale**: User explicitly requested it. Provides a permanent record of decisions for the next maintainer.

**Alternatives rejected**:
- Plan only — denies the audit trail.
- Specify + plan only — same.

## Decision: Module file layout

**Choice**: `services/storyForge/` directory with `index.ts`, `prompts.ts`, `categories.ts`, `llm.ts`, `types.ts`, `storyForge.test.ts` siblings.

**Rationale**: Matches existing `services/notifier/` and `services/telegram/` conventions. Encapsulation: only `index.ts` is meant to be imported externally.

**Alternatives rejected**:
- Single `services/storyForge.ts` file — would balloon to ~400 lines (162 lines of prompts alone) and diverge from the local convention.

## Decision: Branch + PR title naming

**Choice**: Branch `005-storyforge-consolidation`. PR title `feat(005): consolidate prompts + category cache into StoryForge module`.

**Rationale**: Matches existing pattern `004-notifier-deepen` / `004-x-invalidate-revalidation` / `003-deps-upgrade`.

## Decision: Cache lifetime

**Choice**: Explicit `invalidateCategories()` only — no TTL.

**Rationale**: Matches today's behaviour (`services/categories.ts` cache is process-lived, never invalidated). Categories table is small and rarely changes. A TTL would add a clock dependency requiring `vi.useFakeTimers()` in tests for marginal value.

**Alternatives rejected**:
- TTL 5 min + explicit invalidate — adds time-mocking complexity without a current driver.
- TTL 1 hour + explicit invalidate — same trade-off.

## Decision: Error surface

**Choice**: All errors return `AIResult.ok=false`. No throws from StoryForge methods. Infra errors (rate limit, network, timeout) map to `error: 'model'` with the underlying `err.message`.

**Rationale**: Eliminates the inconsistency where two methods threw and two returned defaults. Forces every caller to discriminate at compile time. Solves the empty-log-insert bug systematically.

**Alternatives rejected**:
- Throw infra errors, return AIResult only for parse/validation — preserves split contract; nullifies the bug-fix's design rationale.
- Always throw — reverts to the current style.

## Decision: Route-level error mapping

**Choice**: Routes keep their existing pattern-match copy (`mystical AI assistant`, `connection issue`, `request took too long`). StoryForge stays domain-pure.

**Rationale**: User-facing copy belongs at the HTTP boundary, not in a domain module. Matches the codebase's existing separation.

**Alternatives rejected**:
- Move user copy into StoryForge — couples the domain module to UX strings. Harder to localize later.

## Decision: Snapshot test style

**Choice**: `toMatchInlineSnapshot()` — snapshots embedded in the test file.

**Rationale**: No `__snapshots__/` directory exists in this repo today. Inline snapshots are reviewable in a single file diff during PR review. Four snapshots is a manageable inline footprint.

**Alternatives rejected**:
- File-based `toMatchSnapshot()` — introduces a new convention unfamiliar to this codebase.
- Keep `toContain`-style assertions (current `services/prompts.test.ts` style) — lower fidelity; would miss whitespace and structural drift.

## Decision: PR review iteration loop

**Choice**: Foreground in this session. Spawn a fresh-context Opus subagent for each iteration of `/gh-pr-no-checkout-review`.

**Rationale**: User explicitly opted for foreground; iteration is fast in-session.

**Alternatives rejected**:
- Background `/loop` or `/schedule` — overkill for an active engineering loop.

## Open: none

All decisions resolved. No `[NEEDS CLARIFICATION]` markers in the spec.
