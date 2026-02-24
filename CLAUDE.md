# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Purranormal Activity is a whimsical web app for documenting paranormal events caused by a magical kitten. Users submit event descriptions, which are enriched by AI (OpenAI) to generate titles, descriptions, categories, and DALL-E images. Deployed on Cloudflare Pages.

**Live**: https://purranormal-activity.pages.dev/

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (bumps patch version first)
pnpm build            # Production Next.js build
pnpm lint             # Run Biome linter (biome check .)
pnpm format           # Format code (biome format . --write)
pnpm lint:fix         # Auto-fix lint issues (biome check --write .)
pnpm generate         # Push DB schema changes to Turso (drizzle-kit push)
pnpm preview          # Build & preview on Cloudflare Pages locally
pnpm deploy           # Build & deploy to Cloudflare Pages
```

Husky + lint-staged auto-formats staged files on commit via Biome.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Database**: Turso (SQLite) + Drizzle ORM
- **Styling**: Tailwind CSS (custom mystical palette: deep-purple, midnight-blue, ghost-white, neon-green)
- **Fonts**: Quicksand (primary) + Caveat (accent)
- **AI**: OpenAI (o3 for structured generation, gpt-4o for text, gpt-image-1 for DALL-E images)
- **Storage**: Cloudflare R2 (S3-compatible) for generated images
- **Linter/Formatter**: Biome (single quotes, no semicolons, 2-space indent, 100 char line width)
- **Package Manager**: pnpm
- **Deployment**: Cloudflare Pages (all API routes use edge runtime)

## Architecture

### Directory Layout

- `app/` - Next.js App Router pages and API routes
- `components/` - React components organized by feature (hero/, events/, explore/, newLog/, editLog/, etc.)
- `db/schema.ts` - Drizzle ORM schema (3 tables: `log`, `category`, `log_category`)
- `drizzle/index.ts` - Database connection instance
- `services/` - Business logic (ai.ts, log.ts, categories.ts, prompts.ts, notification.ts, telegram/)
- `utils/` - Utility functions (cloudflare.ts, fetch.ts, http.ts, batch.ts, etc.)
- `hooks/` - React hooks (useExploreData, useInfiniteScroll, useSound, state)
- `env/` - Environment variable modules (db.ts, openai.ts, cloudflare.ts, secret.ts, telegram.ts)
- `instances/` - Singleton clients (openai.ts, s3.ts)
- `data/enum/` - Enumerations (logStatus: Created|ImageGenerated|Error, imageStyle: 16+ styles)
- `types/` - TypeScript types (search.ts, next.ts)
- `constants.ts` - Validation limits and UI config

### Data Flow

1. User submits event description via `/new` page
2. `POST /api/log/submit` - AI (o3 model) generates structured details (title, description, categories, imageDescription)
3. Log inserted into DB with status "Created"
4. `POST /api/script` triggers batch image generation (5 at a time with delays)
5. `POST /api/trigger/[id]` - GPT-4o refines image prompt, DALL-E generates image, uploaded to R2
6. Log status updated to "ImageGenerated", cache revalidated

### Database Schema

Three tables in Turso (SQLite): `log` (events with title, description, status, imageDescription), `category` (name + icon), `log_category` (junction table with cascade delete on log).

### Routes

- `/` - Home with hero section + recent events (revalidates every 60s)
- `/explore` - Filterable/searchable event archive with infinite scroll
- `/new` - Submit new paranormal event form
- `/[id]` - View individual event
- `/[id]/edit` - Edit existing event

### Key Patterns

- Path alias: `@/*` maps to project root
- Favor React Server Components; minimize `use client`, `useEffect`, `setState`
- Wrap client components in Suspense with fallback
- Use `classnames` library for conditional CSS classes
- Named exports for components
- Arrow functions preferred over function declarations
- Interfaces preferred over type aliases
- Maps preferred over enums
- Lowercase-with-dashes for directory names (e.g., `components/auth-wizard`)

## Design Theme

Mystical, whimsical, playful fairy-tale tone. Deep purples/midnight blues primary palette with neon green/ghost white accents. Consistent magical kitten + frightened chick characters throughout.
