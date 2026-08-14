# CLAUDE.md

## Project Overview

Purranormal Activity is a whimsical web app for documenting paranormal events caused by a magical kitten. Users submit event descriptions, which are enriched by AI (OpenAI) to generate titles, descriptions, categories, and DALL-E images.

**Current live**: https://purranormal-activity.grandekello.workers.dev/ (Cloudflare Pages)
**Migration target**: https://purranormal-activity.workers.dev (Cloudflare Workers)

> **Migration complete.** The codebase has been migrated from Next.js to TanStack Start + Vite + Cloudflare Workers. See `plan.md` for historical specs and `backlog.md` for deferred work.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (bumps patch version first)
pnpm lint             # Run Biome linter (biome check .)
pnpm format           # Format code (biome format . --write)
pnpm lint:fix         # Auto-fix lint issues (biome check --write .)
pnpm generate         # Push DB schema changes to Turso (drizzle-kit push)
```

### Build

```bash
pnpm build            # Production build (TanStack Start / Vite)
```

### Workers / Cloudflare

```bash
pnpm run preview      # Local Workers preview (wrangler dev after build:start)
pnpm run deploy       # Deploy to Cloudflare Workers (wrangler deploy)
pnpm run cf-typegen   # Generate Cloudflare Worker types
```

Husky + lint-staged auto-formats staged files on commit via Biome.

## Tech Stack

### Primary Tech Stack

- **Framework**: TanStack Start 1.162.9 + TanStack Router 1.162.9
- **Build**: Vite 7.3.1 + `@cloudflare/vite-plugin` 1.25.5
- **Deployment**: Cloudflare Workers via `wrangler deploy`

### Shared Infrastructure (unchanged by migration)

- **Database**: Turso (SQLite) + Drizzle ORM
- **Styling**: Tailwind CSS v4 (custom mystical palette: deep-purple, midnight-blue, ghost-white, neon-green)
- **Fonts**: Quicksand (primary) + Caveat (accent) — loaded via CSS/static, not `next/font`
- **AI**: OpenAI via the Vercel AI SDK (`gpt-5.6-terra` for log details and image prompts, `gpt-5.6-luna` for refine questions and Telegram messages, `gpt-image-2` for images)
- **Background work**: Cloudflare Queues (`purranormal-image-jobs` + dead-letter) and a 5-minute cron trigger
- **Storage**: Cloudflare R2 for generated images, via the native `IMAGES` bucket binding
- **Linter/Formatter**: Biome (single quotes, no semicolons, 2-space indent, 100 char line width)
- **Package Manager**: pnpm
- **Node**: 22

## Architecture

### Directory Layout

- `start/` - TanStack Start source root (`srcDirectory`): `routes/` (pages + API endpoints), `router.tsx`, `server.ts` (worker entry)
- `components/` - React components organized by feature (hero/, events/, explore/, newLog/, editLog/, etc.)
- `db/schema.ts` - Drizzle ORM schema (3 tables: `log`, `category`, `log_category`)
- `drizzle/index.ts` - Database connection (`drizzle-orm/libsql/web`, Workers-compatible)
- `services/` - Business logic: `imagePipeline/` (image generation orchestration + queue producer/consumer/sweeper), `storyForge/` (all LLM text generation), `imageStore/` (R2), `notifier/`, `telegram/`, `route/` (the `defineHandlers` envelope), `log.ts`, `imageGen.ts`
- `utils/` - Utility functions (fetch.ts, http.ts, batch.ts, etc.)
- `hooks/` - React hooks (useExploreData, useInfiniteScroll, useSound, state)
- `env/server.ts` - Lazy server-only env getters (Workers-safe, single source of truth)
- `env/public.ts` - Browser-facing env (Vite `import.meta.env` + fallback chain)
- `data/enum/` - Enumerations (logStatus: Created|ImageGenerated|Error, imageStyle: 16+ styles)
- `types/` - TypeScript types (search.ts)
- `constants.ts` - Validation limits and UI config

### Data Flow

Image generation runs on a Cloudflare Queue, never inside a request.

1. User submits event description via `/new`
2. `POST /api/log/submit` — `storyForge.logDetails` (`gpt-5.6-terra`) produces title, description, categories and `imageDescription`
3. `imagePipeline.submit` inserts the row with status `Created`, links categories, and enqueues `{ v: 1, logId, source }` on `IMAGE_QUEUE`. The response returns immediately
4. The queue consumer (`start/server.ts` → `services/imagePipeline/consumer.ts`) claims one attempt atomically, then generates: `storyForge.imagePrompt` if `imageDescription` is empty → `gpt-image-2` → R2 `put` at `<logId>/cover.webp` → status `ImageGenerated`
5. On a _transient_ failure the row stays `Created` and the message is retried once after 30s. On a deterministic failure (moderation refusal, storyForge `validation`, missing row) or once the budget is spent, the row becomes `Error`
6. Two backstops: the dead-letter queue consumer forces a stuck row out of `Created`, and a 5-minute cron (`imagePipeline.sweep`) re-enqueues rows whose message was lost and abandons rows whose budget is gone
7. `/[id]` mounts `ImageStatusPoller`, which re-runs the route loader on a backing-off schedule until the status changes

**Anyone who puts a row into `Created` enqueues; only the consumer generates.** Entry points: `submit`, `PUT /api/log/[id]` (when `imageDescription` changed), `POST /api/trigger/[id]` (operator retry, secret-gated), `POST /api/script` (manual enqueue of all pending, secret-gated), and the cron sweeper.

Every endpoint that can create or re-pend a row is secret-gated, `POST /api/log` included: the sweeper pays for an image for any stale `Created` row regardless of who created it, so a single open endpoint would defeat the gates on all the others.

Queue tuning lives in `services/imagePipeline/config.ts`; `config.test.ts` asserts it agrees with `wrangler.jsonc` (queue names, `max_retries`, `retry_delay`, cron, `main`).

### Database Schema

Three tables in Turso (SQLite): `log` (events with title, description, status, imageDescription, error, `attempts`), `category` (name + icon), `log_category` (junction table with cascade delete on log).

`log.attempts` is the durable generation budget: incremented in SQL by the atomic claim (`UPDATE ... WHERE status = 'Created' AND attempts < ?  RETURNING attempts`), reset to 0 when an edit or an operator retry puts the row back into `Created`. Never assign a queue message's own `attempts` counter to it — that restarts at 1 on every re-enqueue.

### Routes

- `/` — Home with hero section + recent events
- `/explore` — Filterable/searchable event archive with infinite scroll
- `/new` — Submit new paranormal event form
- `/[id]` — View individual event
- `/[id]/edit` — Edit existing event

### Environment Variables

**Client-exposed (Vite prefix — target naming):**

- `VITE_APP_URL` _(migrated from `NEXT_PUBLIC_APP_URL`)_
- `VITE_CLOUDFLARE_PUBLIC_URL` _(migrated from `NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL`)_
- `VITE_CLOUDFLARE_DEPLOY_URL` _(migrated from `NEXT_PUBLIC_CLOUDFLARE_DEPLOY_URL`)_

**Server-only secrets (no prefix):**
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `OPENAI_API_KEY`, `SECRET`, `TELEGRAM_BOT_API_KEY`, `TELEGRAM_BOT_CHAT_IDS`, `CLOUDFLARE_IMAGE_TOKEN`

**Cloudflare bindings (`wrangler.jsonc`, not env vars):**

- `IMAGES` — R2 bucket `purranormal-images`, used by `services/imageStore/r2.server.ts`. `remote: true` so local dev/preview write to the real bucket (needs `wrangler login`).
- `IMAGE_QUEUE` — producer binding for queue `purranormal-image-jobs`, used by `services/imagePipeline/adapters/queue.server.ts`. Consumed by this same worker (`max_retries: 1`, `max_batch_size: 1`, `max_concurrency: 2`), with `purranormal-image-jobs-dlq` as its dead-letter queue — also consumed here, discriminated by `batch.queue`. Requires the Workers Paid plan.
- `triggers.crons: ["*/5 * * * *"]` — drives `imagePipeline.sweep()` via the `scheduled` handler.
- `main` points at `./start/server.ts`. That file must export a **plain object literal** with `fetch`, `queue` and `scheduled`: `createServerEntry` from `@tanstack/react-start/server-entry` returns `{ fetch }` only, so wrapping it silently drops the queue and cron handlers from the deployed worker.

### Key Patterns

- Path alias: `@/*` maps to project root
- Favor server functions and TanStack loaders for data fetching; minimize unnecessary client-side state
- Wrap components in Suspense with fallback where appropriate
- Use `classnames` library for conditional CSS classes
- Named exports for components
- Arrow functions preferred over function declarations
- Interfaces preferred over type aliases
- Maps preferred over enums
- Lowercase-with-dashes for directory names (e.g., `components/auth-wizard`)
- URL state management for explore filters: `nuqs` with `nuqs/adapters/tanstack-router`
- Cache strategy: fresh SSR / no-store on Workers; advanced edge caching is deferred backlog

## Design Theme

Mystical, whimsical, playful fairy-tale tone. Deep purples/midnight blues primary palette with neon green/ghost white accents. Consistent magical kitten + frightened chick characters throughout.

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan

<!-- SPECKIT END -->
