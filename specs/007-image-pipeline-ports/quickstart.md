# Quickstart — Image Pipeline Ports & Adapters

End-to-end verification walkthrough. Run after `/speckit-implement` finishes.

## 1. Static checks

```bash
pnpm lint        # Biome — must be green
pnpm test        # Vitest — must be green; coverage ≥ 50%
pnpm build       # Vite + @cloudflare/vite-plugin — must succeed
```

## 2. Boundary-test fingerprint check

```bash
grep -c "vi.mock('@/drizzle')" services/imagePipeline/index.test.ts
grep -c "vi.mock('@/services/imageGen')" services/imagePipeline/index.test.ts
grep -c "vi.mock('@/services/storyForge')" services/imagePipeline/index.test.ts
grep -c "vi.mock('@/utils/cloudflare')" services/imagePipeline/index.test.ts
```

Expected: every command returns `0`. (FR-014, SC-002.)

## 3. Route-decoupling fingerprint check

```bash
grep -nE "from '@/services/imageGen'|from '@/utils/cloudflare'|db\.insert\(log\)" \
  start/routes/api/log/submit.ts \
  start/routes/api/log/\$id.ts \
  start/routes/api/trigger/\$id.ts \
  services/script.ts
```

Expected: zero matches. (FR-012, SC-001.)

## 4. Live submit smoke (requires real Turso + OpenAI + R2 creds)

```bash
pnpm dev
# in another shell:
curl -sS -X POST http://localhost:5173/api/log/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "description":"Cat knocked over a pencil holder at 03:14am — pencils arranged into a pentagram.",
    "answers":[],
    "secret":"<your SECRET env value>"
  }' | jq
```

Expected:
- HTTP 200
- Body: `{"success":true,"id":<N>,"missingCategories":[]}`
- A row with `id = N` exists in `log` with `status = ImageGenerated` and a non-null `imageDescription`.
- An object exists in R2 keyed by `logs/<N>.png`.

## 5. Live generateImageFor smoke

```bash
curl -sS -X POST http://localhost:5173/api/trigger/<id-of-an-Error-row> | jq
```

Expected (from spec edge case): `{"outcome":{"kind":"skipped","reason":"not-pending",...}}` — only `Created` rows are eligible. The trigger route's exhaustive switch on `outcome.kind` produces this body.

```bash
# Reset the row to Created via DB (or use the edit flow in the UI), then:
curl -sS -X POST http://localhost:5173/api/trigger/<id> | jq
```

Expected: `{"outcome":{"kind":"success",...}}` and `status = ImageGenerated`.

## 6. Live drainOnePending smoke

```bash
# With N Created rows in the DB:
curl -sS -X POST http://localhost:5173/api/script | jq
```

Expected:
- `{"success":true,"processed":N}`
- All N rows transitioned to `ImageGenerated` (or `Error`).

```bash
# Re-run immediately:
curl -sS -X POST http://localhost:5173/api/script | jq
```

Expected: `{"success":true,"processed":0}` (idempotent).

## 7. Failure-path smoke (dev-only, optional)

Force the AI image port to throw by temporarily setting `OPENAI_API_KEY=` (empty) in `.env.local` and restarting `pnpm dev`. Then trigger one log:

```bash
curl -sS -X POST http://localhost:5173/api/trigger/<created-row-id> | jq
```

Expected:
- `{"outcome":{"kind":"failed-recorded",...}}`
- The row's `status = Error` and `error` column contains the unwrapped cause (e.g. `"OpenAI API key missing"`), NOT the wrapper `"Image generation failed"`. (FR-017.)

Restore `OPENAI_API_KEY` afterwards.

## 8. Final review gate

Run `/gh-pr-no-checkout-review <PR-URL>` from a fresh sub-agent context. Expect zero P0, zero P1, zero P2 findings (SC-006). Iterate via fix-and-re-review (separate fix sub-agent each time) until the bar is met.
