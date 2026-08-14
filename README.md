# Purranormal Activity

Track magical mishaps and spooky shenanigans of an enchanted kitten. This project is now powered by TanStack Start and deployed on Cloudflare Workers.

![Hero](https://raw.githubusercontent.com/cosimochellini/purranormal-activity/refs/heads/main/images/hero.webp)

## Live

- Production: [https://purranormal-activity.workers.dev](https://purranormal-activity.workers.dev)

## Stack

- Framework: [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)
- Runtime/Deploy: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- Build tool: [Vite](https://vite.dev/)
- Language: [TypeScript](https://www.typescriptlang.org/)
- DB: [Turso](https://turso.tech/) + [Drizzle ORM](https://orm.drizzle.team/)
- Styling: [Tailwind CSS](https://tailwindcss.com/)
- Lint/format: [Biome](https://biomejs.dev/)

## Requirements

- Node.js `22.x`
- `pnpm`

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create local env file:

```bash
cp .env.example .env
```

3. Fill `.env` with required values.

4. Authenticate with Cloudflare:

```bash
pnpm exec wrangler login
```

Generated cover images live in the `purranormal-images` R2 bucket, reached through
the `IMAGES` binding in `wrangler.jsonc`. That binding is declared `remote: true`,
so local dev and preview read and write the **real** bucket instead of a simulated
local one — which keeps uploaded covers resolvable from the public R2 host, but
means image upload and deletion fail until you have logged in.

5. Create the image-generation queues (once per Cloudflare account):

```bash
pnpm exec wrangler queues create purranormal-image-jobs
pnpm exec wrangler queues create purranormal-image-jobs-dlq
```

Both must exist **before** the first deploy — a producer binding to a missing
queue is a hard deploy failure. Queues require the Workers Paid plan.

6. Apply the database schema (adds `log.attempts`, used as the generation
   attempt budget):

```bash
npx drizzle-kit push
```

`pnpm generate` does the same thing but bumps the package version first, so
prefer the direct command during setup.

## Development

Run dev server (keeps current project behavior with patch version bump):

```bash
pnpm dev
```

If you need to skip the automatic version bump, run Vite directly:

```bash
vite dev
```

Default local URL is shown in terminal (typically `http://localhost:3000`).

### Image generation

Generation never runs inside a request. `POST /api/log/submit` saves the row as
`Created` and enqueues a job; the queue consumer in `start/server.ts` does the
work, retries **once** after 30s on a transient failure, and marks the row
`Error` when the attempt budget is spent or the failure is deterministic (a
moderation refusal is not worth a second bill). A dead-letter consumer and a
5-minute cron sweeper make sure no row is left stuck in `Created`.

Local development runs the queues under miniflare, so `pnpm dev` exercises the
real path. Two manual triggers when you do not want to wait for the cron:

```bash
# fire the cron handler (the sweeper)
curl -sS "http://localhost:3000/cdn-cgi/handler/scheduled"

# enqueue every pending row right now
curl -sS -X POST http://localhost:3000/api/script \
  -H 'content-type: application/json' -d '{"secret":"<SECRET>"}'

# reset one row and regenerate it
curl -sS -X POST http://localhost:3000/api/trigger/42 \
  -H 'content-type: application/json' -d '{"secret":"<SECRET>"}'
```

`/api/script` and `/api/trigger/[id]` both require the shared `SECRET` in the
body: after this change each request is a cheap enqueue, so an open endpoint
would be an amplifier for the OpenAI bill.

## Scripts

- `pnpm lint` - run Biome checks
- `pnpm format` - format code
- `pnpm lint:fix` - apply Biome fixes
- `pnpm build` - production build (TanStack Start / Vite)
- `pnpm preview` - preview built app locally
- `pnpm cf-typegen` - generate Worker env types from Wrangler config
- `pnpm deploy` - build and deploy to Cloudflare Workers (no manual pre-build required)
- `pnpm test` - run the Vitest suite
- `pnpm test:coverage` - run the suite with coverage
- `pnpm typecheck` - `tsc --noEmit` over the build project

## Cloudflare Workers

- Project config: [`wrangler.jsonc`](./wrangler.jsonc)
- Deploy script uses generated build config: `dist/server/wrangler.json`
- Worker name: `purranormal-activity`
- Worker entry: `start/server.ts`, referenced by `main`. It exports a plain
  object with `fetch`, `queue` and `scheduled` — do **not** wrap it in
  `createServerEntry`, which returns `{ fetch }` only and would silently drop
  the queue and cron handlers from the deployed worker.
- After changing `wrangler.jsonc`, run `pnpm cf-typegen` and commit the
  regenerated `worker-configuration.d.ts`.

Verify a build really carries the extra handlers before deploying:

```bash
tail -c 400 dist/server/index.mjs   # the default export must list fetch, queue, scheduled
node -e "const c=require('./dist/server/wrangler.json');console.log(c.triggers,c.queues)"
```

Manual deploy alternative:

```bash
pnpm run build:start
wrangler deploy --config dist/server/wrangler.json
```

Dry-run deploy:

```bash
wrangler deploy --dry-run --config dist/server/wrangler.json
```

## Core Routes

- `/`
- `/explore`
- `/new`
- `/:id`
- `/:id/edit`
- `/api/*` internal routes

## Manual QA

See: [`wiki/manual-test.md`](./wiki/manual-test.md)

## License

MIT. See [LICENSE](./LICENSE).
