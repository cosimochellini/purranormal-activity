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

## Scripts

- `pnpm lint` - run Biome checks
- `pnpm format` - format code
- `pnpm lint:fix` - apply Biome fixes
- `pnpm build` - production build (TanStack Start / Vite)
- `pnpm preview` - preview built app locally
- `pnpm cf-typegen` - generate Worker env types from Wrangler config
- `pnpm deploy` - build and deploy to Cloudflare Workers (no manual pre-build required)

## Cloudflare Workers

- Project config: [`wrangler.jsonc`](./wrangler.jsonc)
- Deploy script uses generated build config: `dist/server/wrangler.json`
- Worker name: `purranormal-activity`

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
