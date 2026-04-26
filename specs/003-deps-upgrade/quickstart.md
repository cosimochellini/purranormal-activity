# Quickstart: Reproduce the Upgrade Locally

A reviewer (or future contributor bisecting a regression) can replay the
upgrade end-to-end with the following commands.

## Prerequisites

- Node `>=22.12` (matches the new `engines.node`).
- `pnpm` 9.x.
- A clone of `purranormal-activity` checked out at `003-deps-upgrade`.

## 1. Clean install

```bash
pnpm install --frozen-lockfile
```

The lockfile is the canonical record of what got bumped. No remote
resolution should occur — if it does, the lockfile is stale.

## 2. Generate Cloudflare Worker types

```bash
pnpm cf-typegen
git diff worker-configuration.d.ts
```

`git diff` MUST be empty. A non-empty diff means wrangler 4.85 emits
different bindings than 4.69 and the file needs to be re-committed.

## 3. Lint

```bash
pnpm lint
```

Biome 2.4.13 must exit zero.

## 4. Tests + coverage

```bash
pnpm test:coverage
```

- All ~270 tests pass.
- Coverage report shows ≥50% lines AND ≥50% branches globally.
- The coverage thresholds (50/50/50/50) are enforced inside
  `vitest.config.ts`; a miss exits non-zero.

## 5. Production build

```bash
pnpm build
ls -la dist/server/wrangler.json
```

Vite 8 must successfully compile both client and Workers bundles. The
`dist/server/wrangler.json` file is what `wrangler deploy` consumes.

## 6. Local Workers preview (optional smoke)

```bash
pnpm preview
```

Visit `http://localhost:8787`, click through:

- `/` (home + recent events)
- `/explore` (filterable archive + infinite scroll)
- `/new` (submit form)
- `/<id>` (event detail)
- `/<id>/edit` (edit form)

No console errors should appear in DevTools.

## 7. PR review

Run `/gh-pr-no-checkout-review <PR-URL>` from a fresh agent session.
Acceptance: zero P0, zero P1, and zero P2 findings within at most three
review iterations.
