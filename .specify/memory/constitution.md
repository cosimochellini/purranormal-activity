<!--
Sync Impact Report
==================
Version change: TEMPLATE → 1.0.0
Bump rationale: First concrete ratification of the constitution from a placeholder
template. All five principles + governance freshly defined; treated as a major
release because the prior content was non-binding placeholder text.

Modified principles: N/A (no prior named principles)
Added principles:
  - I. Test-First Pragmatism
  - II. Boundary Mocking
  - III. Type-Safe Edges
  - IV. Cloudflare-First Simplicity
  - V. Observability
Added sections:
  - Quality Gates (testing, build, lint thresholds)
  - Development Workflow (spec-kit workflow + PR process)
  - Governance

Removed sections: All template placeholders.

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate references
    are abstract ("[Gates determined based on constitution file]") and naturally
    align with the principles below; no edits required.
  - ✅ .specify/templates/spec-template.md — Acceptance scenarios + measurable
    outcomes already align with Principle I; no edits required.
  - ✅ .specify/templates/tasks-template.md — Task categorization already
    supports test/build/observability tasks; no edits required.
  - ✅ .specify/templates/checklist-template.md — Generic; no edits required.

Follow-up TODOs: none.
-->

# Purranormal Activity Constitution

## Core Principles

### I. Test-First Pragmatism

The project uses **Vitest** as its sole test runner. Every PR that touches
production code MUST keep coverage at or above **50% lines AND 50% branches**
(also functions and statements), enforced by `vitest run --coverage` thresholds
in CI. Tests MUST be deterministic — they MUST NOT call real networks (OpenAI,
Telegram, Cloudflare Images, R2), real databases (Turso), or rely on wall-clock
time without `vi.useFakeTimers()`. Tests are co-located (`*.test.ts(x)` next to
source) for `utils/`, `services/`, `hooks/`, and `env/`; component and route
tests live under `tests/components/**` and `tests/api/**` respectively, because
TanStack file-based routing rejects co-located test files.

**Rationale**: Without an automated test gate, any refactor or dependency bump
silently regresses production. 50% line and branch coverage is the minimum that
forces both happy paths and at least one error arm to be exercised; perfectionist
goals (90%+) would block delivery in a small project.

### II. Boundary Mocking

External boundaries MUST always be mocked in tests via `vi.mock` at the top of
each test file. The mocked surfaces are: `openai`, `drizzle-orm/libsql/web`,
`@libsql/client`, `@aws-sdk/client-s3`, the global `fetch` (for Telegram and
Cloudflare Images), and `nuqs/adapters/tanstack-router`. Pure code (no I/O, no
side effects) MUST be tested directly without mocks. A shared `tests/helpers.ts`
provides a `makeFakeDb()` chainable Drizzle proxy and standard fetch helpers so
mocks stay consistent.

**Rationale**: Real I/O makes tests slow, flaky, and expensive (OpenAI tokens, R2
egress). A shared mock factory keeps tests trivially portable and prevents each
author from inventing a divergent fake.

### III. Type-Safe Edges

Every API route handler and every form submission boundary MUST validate input
with **Zod** before touching downstream code. Environment variables MUST NOT be
trusted at module load — every read MUST go through `env/required.ts:getRequiredEnv`
or provide an explicit safe default (e.g., `(process.env.X ?? '').split(',')`).
A module that crashes on import because of a missing optional env var is a
constitution violation.

**Rationale**: A single missing secret on a fresh deployment can take down the
entire Worker at startup. Zod at the edge prevents type-system drift between
client, server, and DB. Both rules are enforced in code review.

### IV. Cloudflare-First Simplicity

Test environments are partitioned: **`happy-dom`** for files under `components/`,
`hooks/`, and `tests/components/`; **`node`** for everything else. Production
code MUST NOT use Node-only APIs (`fs`, `child_process`, `node:net`) in hot
paths — the runtime is Cloudflare Workers. TanStack Start route handlers MUST be
importable as plain functions so they can be tested without booting the router.
The Vitest config MUST NOT load the `cloudflare()` or `tanstackStart()` Vite
plugins; they boot Wrangler runtime and break Vitest's worker pool — a separate
`vitest.config.ts` (with only `@vitejs/plugin-react`) is mandatory.

**Rationale**: The deployment target dictates the runtime. Tests must mirror
that runtime as closely as possible while staying fast (happy-dom over jsdom
for component tests, node for service/util tests).

### V. Observability

`utils/logger.ts` is the single logging surface. Production code MUST NOT use
`console.log`, `console.error`, or `console.warn` directly. Promise rejections
MUST NOT be silently swallowed: every `.catch` block MUST either log via
`logger.error` with the original error AND a stack trace, propagate the
rejection, or recover deliberately with a comment explaining why recovery is
safe. `try/catch` blocks that log and return `undefined` (or an empty array)
are forbidden unless paired with a comment justifying the swallow.

**Rationale**: A serverless edge runtime has no stdout to grep. Centralized
logging is the only way to debug production. Silent swallows are the most
common source of "it works locally but not in prod" incidents in this codebase.

## Quality Gates

Every PR MUST pass the following before merge:

1. **`pnpm lint`** (Biome) — zero errors, zero new warnings.
2. **`pnpm build`** (Vite + TanStack Start) — successful production build.
3. **`pnpm test:coverage`** — all tests green, ≥50% lines AND ≥50% branches.
4. **`pnpm cf-typegen`** — produces no uncommitted diff to
   `worker-configuration.d.ts`.
5. **GitHub Actions `lint.yml`** — both `lint` and `test` jobs green.

A PR that violates a constitution principle MUST be either revised or
documented in the PR's `Complexity Tracking` section with explicit
justification reviewed by the maintainer.

## Development Workflow

This project follows the **spec-kit** flow for non-trivial features:

`/speckit-constitution` (this file) → `/speckit-specify` → `/speckit-clarify`
(if needed) → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` →
`/speckit-implement`.

Spec-kit auto-creates the feature branch via `.specify/extensions.yml` and
auto-commits between phases. Trivial fixes (typos, dependency bumps, docs
edits) MAY skip spec-kit and go directly to a PR.

PRs target `main` exclusively; merges are squash. Conventional Commit prefixes
(`feat:`, `fix:`, `test:`, `chore:`, `refactor:`, `docs:`) are required for the
PR title. The PR description MUST list any bugs fixed and link the regression
test that asserts each fix.

## Governance

This constitution supersedes ad-hoc preferences and previous undocumented
conventions. Amendments require:

1. A PR that updates `.specify/memory/constitution.md` with the change AND a
   prepended `Sync Impact Report` HTML comment documenting the bump.
2. A version bump per **semantic versioning**:
   - **MAJOR**: A principle is removed or its meaning is reversed in a
     backward-incompatible way.
   - **MINOR**: A new principle or a new mandatory section is added; existing
     guidance is materially expanded.
   - **PATCH**: Wording, typo, or non-semantic clarification.
3. Propagation review: every dependent template under `.specify/templates/**`
   MUST be re-read and updated in the same PR if the amendment affects it.
4. Approval by the maintainer before merge.

The constitution does not gate emergency fixes for production outages, but
such fixes MUST be followed by a PR that retroactively brings the change into
compliance (tests, observability, type-safety) within seven calendar days.

**Version**: 1.0.0 | **Ratified**: 2026-04-25 | **Last Amended**: 2026-04-25
