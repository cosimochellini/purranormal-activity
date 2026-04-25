# Implementation Plan: Project Hardening — Test Suite & Bug Fixes

**Branch**: `001-project-hardening-tests` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-project-hardening-tests/spec.md`

## Summary

Add Vitest 3 with happy-dom and `@vitest/coverage-v8`, write ~55 test files, fix 16 bugs (each with regression test), gate CI on 50% lines + 50% branches coverage. Single PR to `main`. The technical approach is in this plan; the user-facing rationale is in `spec.md`.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode), Node 22.x.
**Primary Dependencies**: Vitest 3.x, `@vitest/coverage-v8`, happy-dom, `@testing-library/react`, `@testing-library/jest-dom`. Existing: TanStack Start 1.163, Vite 7.3, React 19.2, Drizzle 0.45 + Turso, OpenAI 6.25, AWS S3 SDK, nuqs 2.8, Zod 4, Biome 2.4.
**Storage**: Turso (SQLite, HTTP) — mocked in tests.
**Testing**: Vitest with `environmentMatchGlobs` partitioning (happy-dom for `components/`/`hooks/`/`tests/components/`; node for everything else). External boundaries (`openai`, `drizzle-orm/libsql/web`, `@aws-sdk/client-s3`, `fetch`, `nuqs/adapters/tanstack-router`) are always mocked.
**Target Platform**: Cloudflare Workers (production); Node 22 (CI + local dev).
**Project Type**: web app (frontend + serverless backend in same repo).
**Performance Goals**: test suite < 60 s on developer laptop (SC-001); CI overhead ≤ 90 s (SC-006).
**Constraints**: deterministic tests (no real network, no real DB); cannot run `cloudflare()` or `tanstackStart()` Vite plugins inside Vitest (they boot Wrangler runtime and break the worker pool — separate `vitest.config.ts` is mandatory).
**Scale/Scope**: ~3,500 LOC test-eligible after exclusions; 16 bug fixes; ~55 test files.

## Constitution Check

*Gate: must pass before Phase 0; re-check after design.*

| Principle | Compliance |
|---|---|
| I. Test-First Pragmatism | ✅ Vitest installed; 50/50 thresholds enforced in `vitest.config.ts`; deterministic. |
| II. Boundary Mocking | ✅ All five external boundaries mocked via `vi.mock`; pure code unmocked. |
| III. Type-Safe Edges | ✅ Zod validation kept; `env/telegram.ts` rewritten to use safe default (Bug #1 fix). |
| IV. Cloudflare-First Simplicity | ✅ Separate `vitest.config.ts` excludes Cloudflare/TanStack plugins; happy-dom + node split. |
| V. Observability | ✅ All 16 bug fixes route diagnostics through `utils/logger`; remove `console.error` calls (Bug #13). |

**Verdict**: All gates pass. No constitution violations; no Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-hardening-tests/
├── plan.md              # This file
├── spec.md              # Feature specification
├── tasks.md             # Task breakdown (this file's sibling)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
purranormal-activity/
├── vitest.config.ts                        # NEW — separate from vite.config.mts
├── test-setup.ts                           # NEW — global mocks + jest-dom matchers
├── tests/
│   ├── helpers.ts                          # NEW — makeFakeDb, fetch helpers
│   ├── components/                         # NEW — *.test.tsx for components
│   └── api/                                # NEW — *.test.ts for route handlers
├── utils/                                  # *.test.ts co-located
├── services/                               # *.test.ts co-located
├── hooks/                                  # *.test.ts co-located (after rename)
├── env/                                    # *.test.ts co-located
├── components/                             # bug fixes only (no co-located tests)
├── start/routes/api/                       # bug fixes only
└── .github/workflows/lint.yml              # extended with `test` job
```

**Structure Decision**: Co-locate test files with source for `utils/`, `services/`, `hooks/`, `env/` (low ceremony). Mirror under `tests/components/**` and `tests/api/**` for components and TanStack route handlers, because file-based routing rejects co-located test files.

## Phase 0 — Research (already completed)

Three Explore agents surveyed the codebase pre-plan:
- Pure-test inventory + integration boundaries + 2 critical / 7 medium bugs in `services/`, `utils/`, `env/`, `db/`.
- Component / hook / route inventory + 13 frontend bugs.
- Tooling inventory: no existing tests; constitution empty; CI lint-only.

Key findings (drove this plan):
1. `cloudflare()` + `tanstackStart()` plugins crash Vitest → separate config.
2. Cached `services/categories.ts` map needs a reset hook for test isolation.
3. `services/prompts.ts` is 255 LOC of pure templates — single biggest coverage win.
4. `routeTree.gen.ts` and `worker-configuration.d.ts` must be excluded.

## Phase 1 — Design

### `vitest.config.ts`

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': rootDir } },
  test: {
    globals: true,
    setupFiles: ['./test-setup.ts'],
    environmentMatchGlobs: [
      ['components/**', 'happy-dom'],
      ['hooks/**', 'happy-dom'],
      ['tests/components/**', 'happy-dom'],
      ['**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['utils/**', 'services/**', 'hooks/**', 'components/**', 'start/routes/api/**', 'env/**'],
      exclude: ['**/*.test.*', '**/*.d.ts', 'dist/**', 'drizzle/**', 'static/**', '**/index.ts', '**/routeTree.gen.ts'],
      thresholds: { lines: 50, branches: 50, functions: 50, statements: 50 },
    },
    server: { deps: { inline: ['@tanstack/react-router', 'nuqs'] } },
  },
})
```

### `test-setup.ts`

- `import '@testing-library/jest-dom/vitest'`
- `vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() } }))`
- `vi.mock('nuqs/adapters/tanstack-router', () => ({ NuqsAdapter: ({ children }) => children }))`
- `vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))))`
- `afterEach(vi.resetAllMocks)`

### `tests/helpers.ts`

- `makeFakeDb()` — chainable Drizzle proxy; per-test override terminal calls (`.all()`, `.get()`, `.returning()`).
- `mockFetchSequence(responses)` — queue Response objects.
- `mockOpenAIClient(overrides)` — factory.
- `mockS3Client()` — factory with `send` spy.

### Boundary mock conventions (one per affected file)

```ts
vi.mock('@libsql/client', () => ({ createClient: () => ({}) }))
vi.mock('drizzle-orm/libsql/web', () => ({ drizzle: () => makeFakeDb() }))
vi.mock('openai', () => ({ default: vi.fn(() => mockOpenAIClient()) }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: vi.fn() })),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}))
```

### `package.json` additions

- devDeps: `vitest@^3`, `@vitest/coverage-v8@^3`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `happy-dom@^15`.
- scripts: `"test": "vitest run"`, `"test:watch": "vitest watch"`, `"test:coverage": "vitest run --coverage"`.

### `.github/workflows/lint.yml` — add `test` job

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
      with: { version: 9 }
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm test:coverage
```

## Phase 2 — Parallel Implementation (3 opus agents)

Partition by directory; no file overlap.

| Agent | Owns | Tests | Bug fixes |
|---|---|---|---|
| **A** | `utils/`, `services/`, `db/` | ~16 files | #2, #15, #16 |
| **B** | `hooks/`, `components/`, `tests/components/` | ~25 files | #3, #4, #5, #6, #7, #8, #9, #10, #11, #13, #14 |
| **C** | `env/`, `start/routes/api/`, `tests/api/` | ~14 files | #1, #12 |

Agent A finishes shared `tests/helpers.ts` (`makeFakeDb`, mock factories) first; B and C unblock. All commits use Conventional Commits.

## Phase 3 — Verify locally → open PR

```bash
pnpm install --frozen-lockfile
pnpm cf-typegen
pnpm lint
pnpm build
pnpm test:coverage   # must hit 50/50
git push -u origin 001-project-hardening-tests
gh pr create --base main --title "test: vitest suite + 16 bug fixes" --body "..."
```

## Phase 4 — Iterate `/gh-pr-no-checkout-review` (≤ 3 rounds)

```text
loop up to 3:
  /gh-pr-no-checkout-review <PR-URL>   (subagent: general-purpose, zero context)
  triage findings → {P0, P1, P2}        (ignore P3)
  if empty: stop
  spawn 3 opus agents (A/B/C, only flagged files)
  each agent: fix → pnpm lint && pnpm test:coverage (must stay green)
  push; re-review
```

## Complexity Tracking

*No constitution violations to justify. This section intentionally empty.*
