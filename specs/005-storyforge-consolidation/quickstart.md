# Quickstart: StoryForge Module Consolidation

## Prerequisites

- Node 22 (per `.nvmrc`)
- pnpm 10 (per `package.json` engines)
- A populated `.env` file (copy from `.env.example` and fill secrets) for `pnpm dev`

## Run the test suite

```bash
pnpm test
```

Expected: all suites green, including:

- `services/storyForge/storyForge.test.ts` — 4 intents × 4 outcomes (success / parse / model / validation), cache lifecycle, 4 inline prompt snapshots, model-selection assertions.
- `services/imageGen.test.ts` — happy path + image-generation-failure throw.
- `tests/api/log.submit.test.ts` — includes the new bug-fix assertion: `db.insert(log)` is NOT called when `storyForge.logDetails` returns `{ ok: false }`.
- `tests/api/log.refine.test.ts` — AIResult error envelope maps to friendly message.

## Run the linter and type checker

```bash
pnpm lint && pnpm typecheck
```

Expected: zero issues.

## Run the production build

```bash
pnpm build
```

Expected: Vite + TanStack Start + Cloudflare plugin build completes.

## Manual smoke test

1. `pnpm dev` (boots Vite dev server on http://localhost:3000)
2. Open `/new`, submit a description, observe the AI-generated questions render.
3. Submit answers, observe the new log appear at `/`.
4. Stop the dev server. Edit `.env`, replace `OPENAI_API_KEY` with an invalid value. Restart `pnpm dev`.
5. Repeat step 2 — expect a friendly "mystical AI assistant unavailable" error and **no new row** in the explore feed when refreshed.

## Smoke-test the imageGen extraction

```bash
# trigger image generation for an existing pending log
curl -X POST http://localhost:3000/api/trigger/<id>
```

Expected: same behaviour as before this refactor.

## Verify deletions

```bash
test ! -e services/ai.ts && echo "ai.ts deleted"
test ! -e services/prompts.ts && echo "prompts.ts deleted"
test ! -e services/categories.ts && echo "categories.ts deleted"
test ! -e services/ai.test.ts && echo "ai.test.ts deleted"
test ! -e services/prompts.test.ts && echo "prompts.test.ts deleted"
test ! -e services/categories.test.ts && echo "categories.test.ts deleted"
```

All six lines should print.

## Verify private-prompts encapsulation

```bash
# zero hits expected outside services/storyForge/
grep -rn "from '@/services/prompts'" services/ start/ tests/ utils/ hooks/ components/ 2>/dev/null
grep -rn "from '@/services/categories'" services/ start/ tests/ utils/ hooks/ components/ 2>/dev/null
```

Both greps should produce no output (only the StoryForge module imports them, and those imports use relative paths internally).
