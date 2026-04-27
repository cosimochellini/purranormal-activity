# Implementation Plan: StoryForge Module Consolidation

**Branch**: `005-storyforge-consolidation` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-storyforge-consolidation/spec.md`

## Summary

Consolidate `services/ai.ts` (4 prompt-driven entries), `services/prompts.ts`, and `services/categories.ts` into a single deep module `services/storyForge/` exposing `createStoryForge` factory + `storyForge` singleton. Replace inconsistent return shapes (sentinel default vs. throw) with a uniform `AIResult<T>` discriminated union. Move the non-prompt-driven `generateImageBase64` to `services/imageGen.ts`. Migrate all four caller sites in one PR; delete the three superseded files. Fix the empty-log-insert bug in `start/routes/api/log/submit.ts` by gating the `db.insert(log)` call behind `if (r.ok)`.

The user-approved engineering plan (decision tables, file inventory, migration sequence, verification matrix) lives at `/Users/cosimochellini/.claude/plans/implement-with-spec-kit-https-github-com-compiled-squid.md` — this plan summarises and references it rather than duplicating.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, target ES2017, module esnext, bundler resolution)
**Primary Dependencies**: TanStack Start 1.162.9, TanStack Router 1.162.9, Drizzle ORM (libsql/web), `@ai-sdk/openai` + `ai` (`generateText`, `generateImage`), Tailwind v4
**Storage**: Turso (SQLite) — only the `categories` table read path participates in this refactor
**Testing**: Vitest 4.1.5 + `@vitejs/plugin-react`; `node` env (default), `happy-dom` opt-in via `/** @vitest-environment happy-dom */`. Inline snapshots via `toMatchInlineSnapshot()`
**Target Platform**: Cloudflare Workers (via `@cloudflare/vite-plugin` and `wrangler deploy`)
**Project Type**: Single project (monolith TanStack Start app)
**Performance Goals**: No new perf goals — refactor is structural. Existing latency budget for `POST /api/log/submit` remains unchanged
**Constraints**: No Node-only APIs in hot paths (Cloudflare-First); the categories cache must remain process-local because Workers spin up fresh instances per request batch
**Scale/Scope**: ~6 new module files + ~6 file deletions + 4 caller-site edits + ~4 test-file edits

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Note |
|---|---|---|
| **I. Test-First Pragmatism** | PASS | New `services/storyForge/storyForge.test.ts` covers all 4 intents × 4 result variants + cache lifecycle + 4 inline prompt snapshots. Coverage stays >=50% lines/branches. |
| **II. Boundary Mocking** | PASS | The new internal `llm` port REPLACES direct `@ai-sdk/openai` + `generateText` imports inside the module — improves boundary mocking. Tests inject a recording stub via `createStoryForge({ llm })`. The `categories` port replaces direct Drizzle access. |
| **III. Type-Safe Edges** | PASS | Route Zod validators unchanged. `AIResult<T>` adds compile-time discrimination at every caller — verified by SC-004. |
| **IV. Cloudflare-First Simplicity** | PASS | No Node-only APIs introduced. Module is plain functions, importable without Wrangler. Tests stay in `node` env. |
| **V. Observability** | PASS | Adapters keep `logger.error` calls. `AIResult` ENDS the silent-swallow pattern in `generateLogDetails` (the empty-shape default is replaced by an explicit `{ ok: false }`). Every error path is now addressable. |

No violations → no Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/005-storyforge-consolidation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── storyForge.ts    # Public type-only contract
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
services/
├── storyForge/
│   ├── index.ts                # Public surface: createStoryForge, storyForge, types
│   ├── prompts.ts              # Private — moved from services/prompts.ts
│   ├── categories.ts           # Private — categories port + Drizzle adapter (closure cache)
│   ├── llm.ts                  # Private — llm port + @ai-sdk/openai adapter
│   ├── types.ts                # AIResult<T>, LogDetails, QuestionSpec, Answer, Deps
│   └── storyForge.test.ts      # Unit tests (success/error/cache/snapshots/model selection)
├── imageGen.ts                 # New — extracted generateImageBase64
├── imageGen.test.ts            # New — ported from ai.test.ts
├── trigger.ts                  # MODIFIED — imports storyForge + imageGen
├── notifier/
│   └── index.ts                # MODIFIED — composeMessage adapter unwraps AIResult
├── ai.ts                       # DELETED
├── ai.test.ts                  # DELETED
├── prompts.ts                  # DELETED
├── prompts.test.ts             # DELETED
├── categories.ts               # DELETED
└── categories.test.ts          # DELETED

start/routes/api/log/
├── refine.ts                   # MODIFIED — storyForge.questions; if (!r.ok) error mapping
└── submit.ts                   # MODIFIED — storyForge.logDetails; bug fix gates db.insert

tests/api/
├── log.refine.test.ts          # MODIFIED — vi.mock @/services/storyForge; AIResult shape
└── log.submit.test.ts          # MODIFIED — same + new bug-fix assertion test

services/trigger.test.ts        # MODIFIED — vi.mock @/services/storyForge + @/services/imageGen
```

**Structure Decision**: Match the existing service convention (`services/notifier/`, `services/telegram/` are directories with `index.ts` + siblings). Public surface is the `index.ts`; everything else is internal.

## Phase 0: Outline & Research

The user-approved engineering plan resolved all open questions interactively before this speckit invocation. Phase 0 output (`research.md`) records the decisions and rejected alternatives for future readers.

## Phase 1: Design & Contracts

`data-model.md` documents the public types (`AIResult<T>`, `StoryForge`, `LogDetails`, `QuestionSpec`, `Answer`) and the internal `Deps` interface (NOT exported).

`contracts/storyForge.ts` is a type-only contract file mirroring the public surface, suitable for verifying the implementation against the spec.

`quickstart.md` documents how to run the feature end-to-end (build, test, smoke).

Agent context: `CLAUDE.md` already references `plan.md` indirectly via "read the current plan" — no SPECKIT marker block exists, so no edit is required.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations.
