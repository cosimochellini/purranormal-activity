# CLAUDE.md

## Project Overview

Purranormal Activity is a whimsical web app for documenting paranormal events caused by a magical kitten. Users submit event descriptions, which are enriched by AI (OpenAI) to generate titles, descriptions, categories, and DALL-E images.

**Current live**: https://purranormal-activity.pages.dev/ (Cloudflare Pages)
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
- **Storage**: Cloudflare R2 for generated images, via the native `IMAGES` bucket binding
- **Linter/Formatter**: Biome (single quotes, no semicolons, 2-space indent, 100 char line width)
- **Package Manager**: pnpm
- **Node**: 22

## Architecture

### Directory Layout

- `app/` - TanStack Start routes and API endpoints
- `components/` - React components organized by feature (hero/, events/, explore/, newLog/, editLog/, etc.)
- `db/schema.ts` - Drizzle ORM schema (3 tables: `log`, `category`, `log_category`)
- `drizzle/index.ts` - Database connection (`drizzle-orm/libsql/web`, Workers-compatible)
- `services/` - Business logic (ai.ts, log.ts, categories.ts, prompts.ts, notification.ts, telegram/, imageStore/)
- `utils/` - Utility functions (fetch.ts, http.ts, batch.ts, etc.)
- `hooks/` - React hooks (useExploreData, useInfiniteScroll, useSound, state)
- `env/server.ts` - Lazy server-only env getters (Workers-safe, single source of truth)
- `env/public.ts` - Browser-facing env (Vite `import.meta.env` + fallback chain)
- `data/enum/` - Enumerations (logStatus: Created|ImageGenerated|Error, imageStyle: 16+ styles)
- `types/` - TypeScript types (search.ts)
- `constants.ts` - Validation limits and UI config

### Data Flow

1. User submits event description via `/new` page
2. `POST /api/log/submit` — AI (o3) generates structured details (title, description, categories, imageDescription)
3. Log inserted into DB with status `Created`
4. `POST /api/script` triggers batch image generation (5 at a time with delays)
5. `POST /api/trigger/[id]` — GPT-4o refines image prompt, DALL-E generates image, uploaded to R2
6. Log status updated to `ImageGenerated`

### Database Schema

Three tables in Turso (SQLite): `log` (events with title, description, status, imageDescription), `category` (name + icon), `log_category` (junction table with cascade delete on log).

### Routes

- `/` — Home with hero section + recent events
- `/explore` — Filterable/searchable event archive with infinite scroll
- `/new` — Submit new paranormal event form
- `/[id]` — View individual event
- `/[id]/edit` — Edit existing event

### Environment Variables

**Client-exposed (Vite prefix — target naming):**
- `VITE_APP_URL` *(migrated from `NEXT_PUBLIC_APP_URL`)*
- `VITE_CLOUDFLARE_PUBLIC_URL` *(migrated from `NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL`)*
- `VITE_CLOUDFLARE_DEPLOY_URL` *(migrated from `NEXT_PUBLIC_CLOUDFLARE_DEPLOY_URL`)*

**Server-only secrets (no prefix):**
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `OPENAI_API_KEY`, `SECRET`, `TELEGRAM_BOT_API_KEY`, `TELEGRAM_BOT_CHAT_IDS`, `CLOUDFLARE_IMAGE_TOKEN`

**Cloudflare bindings (`wrangler.jsonc`, not env vars):**
- `IMAGES` — R2 bucket `purranormal-images`, used by `services/imageStore/r2.server.ts`. `remote: true` so local dev/preview write to the real bucket (needs `wrangler login`).

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
