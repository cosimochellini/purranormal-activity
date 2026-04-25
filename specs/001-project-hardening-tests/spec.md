# Feature Specification: Project Hardening — Test Suite & Bug Fixes

**Feature Branch**: `001-project-hardening-tests`
**Created**: 2026-04-25
**Status**: Draft
**Input**: User description: "Add Vitest test suite reaching ≥50% lines AND ≥50% branches coverage with regression tests for 16 known bugs and fix all of them. Single PR. CI gates coverage."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Every Known Bug Has a Regression Test (Priority: P1)

As a maintainer, when I open the project after a long gap or a junior developer
joins, I need to know that each previously-discovered defect is locked behind a
regression test, so I can refactor with confidence and never re-ship the same
bug twice.

**Why this priority**: The codebase ships to production with 16 known defects,
two of which crash the app or mislead the user. Tests that *only* document
current (buggy) behaviour are worse than no tests — they entrench bugs. The
minimum viable hardening is: fix each bug AND add a test that fails on the
pre-fix code and passes on the post-fix code.

**Independent Test**: Revert any single bug fix in isolation; the matching
regression test MUST fail. Re-apply the fix; the test MUST pass. This works
without any other story being delivered.

**Acceptance Scenarios**:

1. **Given** the Telegram chat-id env var is unset, **When** the app starts,
   **Then** the module load does not throw — it falls back to an empty list and
   logs a warning. A regression test asserts both the no-throw behaviour and
   the warning.
2. **Given** a Telegram photo send fails after the message succeeds, **When**
   the caller inspects the result, **Then** the returned `error` field
   originates from the photo failure, not the message success. A regression
   test asserts the error provenance.
3. **Given** the explore filter UI rapidly changes filters three times in a
   row, **When** results render, **Then** only the most recent filter's
   results are shown — no race-condition flicker. A regression test exercises
   the abort path.
4. **Given** a user picks "Other" on a refinement question without typing
   anything, **When** they submit, **Then** the form blocks submission with a
   field error. A regression test asserts the rejection.
5. **Given** the second category-association API call fails after the first
   succeeds, **When** the modal closes, **Then** the user sees an error — not
   a silent success. A regression test asserts the error surface.
6. **Given** the AI refinement endpoint rejects, **When** the initial form's
   `.catch` runs, **Then** the form does not crash by reading `.content` from
   undefined. A regression test asserts the null-guard.
7. **Given** the edit-log delete request fails, **When** the finally block
   resets state, **Then** both `submitting.delete` and `submitting.form` are
   left in a consistent state. A regression test asserts the post-failure
   state.
8. **Given** infinite scroll fetches a page after `hasMore` toggled, **When**
   the next intersection fires, **Then** the effect captures fresh state, not
   a stale closure. A regression test asserts the dependency array fix.
9. **Given** an event image fails to load, **When** the user clicks it, **Then**
   the navigation rejection is surfaced (logged + user feedback) — not silently
   swallowed. A regression test asserts the rejection path.
10. **Given** the image-trigger polling endpoint rejects, **When** the
    `.then`/`.catch` chain runs, **Then** `shouldRefetch` is set only on
    success — not on every settled promise. A regression test asserts both
    arms.
11. **Given** the periodic refetch timer fires, **When** the timer's effect
    runs, **Then** the page does not call `window.location.reload()` — it
    invalidates the route. A regression test asserts no reload is invoked.
12. **Given** a malformed Zod input is submitted to `/api/log/submit`, **When**
    `z.treeifyError().errors` is null, **Then** the handler returns a 400 with
    a default message — not crash on a null-property access. A regression test
    asserts both null and non-null branches.
13. **Given** a swallowed error in `setLogError`, **When** the DB write fails,
    **Then** the error is logged with stack trace via `utils/logger`, not
    silently lost. A regression test asserts the log call.
14. **Given** the explore filters re-render, **When** the legacy `useRef`
    loading flag is queried, **Then** the refactored `useState`-based loading
    indicator is surfaced via accessible status text. A regression test asserts
    the loading state is observable in the rendered DOM.
15. **Given** the misnamed `hooks/useExporeData.ts` file, **When** any consumer
    imports the hook, **Then** the import path is `@/hooks/useExploreData`. No
    consumer references the old typo path. A regression test (TypeScript
    compilation + import resolution) asserts no stale path remains.
16. **Given** the cached category map in `services/categories.ts`, **When** the
    test suite resets between cases, **Then** an exported `__resetCategoryCache`
    function clears the module-level cache. A regression test asserts the cache
    is empty after reset.

---

### User Story 2 — Coverage Threshold Gates CI (Priority: P2)

As a maintainer reviewing PRs, I need automated CI to fail any PR that drops
coverage below 50% lines or 50% branches, so that future contributors cannot
silently weaken the safety net.

**Why this priority**: A test suite without an enforced floor decays. The
threshold gate is what converts the suite from "documentation" to "guardrail".
This is P2 because Story 1 delivers the value; this story makes the value
durable.

**Independent Test**: Locally run `pnpm test:coverage`. Threshold miss exits
non-zero; threshold met exits zero. Push a branch that deletes a covered file:
CI red. Push a branch that adds well-covered code: CI green.

**Acceptance Scenarios**:

1. **Given** all tests pass and global coverage is 51% lines AND 51% branches,
   **When** CI runs `pnpm test:coverage`, **Then** the job exits zero and the
   PR is mergeable.
2. **Given** all tests pass but coverage drops to 49% lines, **When** CI runs
   `pnpm test:coverage`, **Then** the job exits non-zero with a message naming
   the failing threshold.
3. **Given** a PR is opened, **When** GitHub Actions runs, **Then** both `lint`
   and `test` jobs run; merging is blocked unless both are green.

---

### User Story 3 — Pure Code Is Exhaustively Tested (Priority: P3)

As a developer, I want pure utility functions and prompt templates to have
near-100% line and branch coverage, so I can refactor them without worry and
new contributors can use the existing tests as a usage manual.

**Why this priority**: Pure code is the cheapest to test (no mocks) and the
highest-leverage to break (used everywhere). Maximising coverage here pulls
the global coverage average up and frees Stories 1–2 to focus on the
high-value bug fixes and integration paths.

**Independent Test**: Run `pnpm test:coverage` and confirm `utils/`,
`services/prompts.ts`, and the pure helpers in `services/log.ts` and
`services/ai.ts` (`addCategories`, `removeHTMLTags`) report ≥95% line and
branch coverage individually.

**Acceptance Scenarios**:

1. **Given** the pure utilities `array`, `batch`, `time`, `typed`, `promise`,
   `random`, `http`, `public-image`, `viewTransition`, **When** their test
   files run, **Then** each reports ≥95% line and branch coverage.
2. **Given** `services/prompts.ts`, **When** its test file runs, **Then** every
   exported template function is exercised at least once and the file reports
   100% line coverage.

---

### Edge Cases

- App starts with `TELEGRAM_BOT_CHAT_IDS` unset → must not crash.
- Telegram chat list empty → notification service returns a no-op success.
- AI returns malformed JSON → caller receives a deterministic empty value, not
  a crash. (Acknowledged existing behaviour; preserved.)
- User changes explore filters mid-fetch → previous request aborts; only the
  newest result renders.
- User submits the refinement form with "Other" selected but `otherText`
  blank → field error blocks submission.
- DB write in `setLogError` fails → error is logged with stack via the central
  logger; no silent swallow.
- Cached category map carries leftover state into a new test → exported reset
  function purges it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST contain a working Vitest setup (`vitest.config.ts`,
  `test-setup.ts`, devDeps installed, scripts in `package.json`).
- **FR-002**: The Vitest run MUST achieve ≥50% lines AND ≥50% branches coverage
  globally; thresholds enforced inside the Vitest config so a miss exits
  non-zero.
- **FR-003**: Every one of the 16 known bugs MUST have at least one regression
  test that fails on the pre-fix code and passes on the post-fix code.
- **FR-004**: GitHub Actions MUST run a `test` job (in addition to the existing
  `lint` job) that calls `pnpm test:coverage` and blocks merge on failure.
- **FR-005**: External boundaries (OpenAI, libsql/web, S3 client, global fetch,
  nuqs adapter) MUST NOT be invoked for real during tests; all tests MUST run
  offline and deterministically.
- **FR-006**: All 16 bugs MUST be fixed in production code in the same PR as
  the regression tests.
- **FR-007**: The misnamed file `hooks/useExporeData.ts` MUST be renamed to
  `hooks/useExploreData.ts`; every consumer's import MUST be updated.
- **FR-008**: `services/categories.ts` MUST export a `__resetCategoryCache`
  function used by tests to clear module-level state between cases.
- **FR-009**: `env/telegram.ts` MUST read its env var defensively (default to
  empty list and log a warning) instead of crashing on undefined.
- **FR-010**: No production code MUST use `console.error` / `console.log`; all
  diagnostic output MUST go through `utils/logger`.
- **FR-011**: `pnpm lint`, `pnpm build`, `pnpm test:coverage`, and
  `pnpm cf-typegen` MUST all pass locally before the PR is opened.
- **FR-012**: The PR MUST be a single PR targeting `main` from
  `001-project-hardening-tests`.
- **FR-013**: No husky / lint-staged behaviour MUST change.
- **FR-014**: `routeTree.gen.ts`, `worker-configuration.d.ts`, generated
  drizzle output, and other generated files MUST be excluded from coverage
  measurement.
- **FR-015**: Test files MUST be co-located with source for `utils/`,
  `services/`, `hooks/`, and `env/`; component and route tests MUST live under
  `tests/components/**` and `tests/api/**` respectively.

### Key Entities *(this feature is infrastructural — no new domain entities)*

- **Test Suite**: ~55 test files covering pure logic, hooks, components, API
  route handlers, and env modules.
- **Coverage Report**: An LCOV + HTML + text artefact emitted by Vitest's v8
  coverage provider, gated by configured thresholds.
- **Bug Inventory**: A frozen list of 16 defects (stored in this spec's
  acceptance scenarios) each mapped to a regression test.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running the test suite locally completes in under 60 seconds on
  a developer laptop.
- **SC-002**: Coverage report shows ≥50% lines AND ≥50% branches globally.
- **SC-003**: All 16 bugs documented in the acceptance scenarios are fixed and
  each has at least one regression test in the same PR.
- **SC-004**: `/gh-pr-no-checkout-review` reports zero P0, zero P1, and zero
  P2 findings on the resulting PR within at most three review iterations.
- **SC-005**: Pure utility files (`utils/array`, `batch`, `time`, `typed`,
  `promise`, `random`, `http`, `public-image`, `viewTransition`) and
  `services/prompts.ts` each report ≥95% line coverage.
- **SC-006**: CI pipeline duration grows by no more than 90 seconds compared
  to the previous lint-only baseline.
- **SC-007**: After the PR merges, no `console.error` or `console.log` call
  remains in production source files (`utils/`, `services/`, `hooks/`,
  `components/`, `start/`, `app/`, `env/`).

## Assumptions

- The repository remains on Cloudflare Workers (TanStack Start + Vite); no
  framework migration is bundled with this hardening work.
- Vitest 3.x and `@vitest/coverage-v8` are compatible with Vite 7.3.1 (no
  major-version upgrade of Vite is required).
- happy-dom is sufficient for component tests; jsdom is not introduced.
- TanStack Start route handlers are importable as plain modules and their
  exported `Route` objects expose handlers callable with a mock `Request`.
- `nuqs/adapters/tanstack-router` can be mocked with a no-op adapter without
  breaking hook semantics under test.
- The existing `husky` pre-commit hook (`lint-staged` running Biome format)
  remains unchanged.
- No real Turso, OpenAI, R2, Telegram, or Cloudflare Images credentials are
  required to run the test suite.
- `pnpm` v9 and Node 22 (per `engines.node` in `package.json`) are available
  on contributor machines and on GitHub Actions runners.
