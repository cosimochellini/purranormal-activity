# TanStack Start Migration Plan (LLM Execution Spec)

## 1. Mission
Migrate this repository in-place from Next.js App Router to TanStack Start, targeting Cloudflare Workers, while minimizing regressions and preserving current behavior for end users.

This plan is designed to be executable by an LLM in multiple coding phases. Each phase must produce code, keep lint/build green, and end with a clear handoff for manual testing by the project owner.

## 2. Locked Decisions (Do Not Reopen)
1. In-place migration on current repository.
2. Keep current user-facing routes if possible: `/`, `/explore`, `/new`, `/:id`, `/:id/edit`, custom 404.
3. API is internal-only, but keep HTTP `/api/*` endpoints for now.
4. Deployment target is Cloudflare Workers.
5. Worker name: `purranormal-activity`.
6. Preferred domain target: `https://purranormal-activity.workers.dev`.
7. Single environment (prod-like local usage), no multi-env work now.
8. Keep current image-generation trigger flow for now.
9. Keep query parameter names/semantics for explore filters.
10. Keep current 500ms polling behavior for generated images.
11. View transitions are best effort.
12. Replace `next/image` with `<img>` for now.
13. Keep current fonts (Quicksand + Caveat).
14. Keep easter egg behavior: 5 clicks on detail image opens edit page.
15. Keep SEO metadata behavior equivalent.
16. Remove broken links to missing pages (`/discover`, `/stats`, `/secrets`) instead of adding placeholders.
17. Normalize public env naming to Vite (`VITE_*`).
18. Use Node 22 and align CI to Node 22.
19. Lint must stay green throughout migration (continuous guardrail).
20. No AI commit/push. Owner tests and commits manually.
21. Build-system cutover must be explicit and phase-safe (dual build until flip).
22. Workers runtime validation starts before final phase (not only at the end).

## 2.1 Version Baseline (Pinned for Migration Start)
Pin and use this set unless a hard blocker appears:
1. `@tanstack/react-start`: `1.162.9`
2. `@tanstack/react-router`: `1.162.9`
3. `vite`: `7.3.1`
4. `@vitejs/plugin-react`: `5.1.4`
5. `@cloudflare/vite-plugin`: `1.25.5`
6. `wrangler`: `4.68.1`
7. `nuqs`: `2.8.8` (with TanStack router adapter)

If a version bump is required, record why in phase handoff and keep lockfile deterministic.

## 2.2 Build Transition Strategy (Critical)
To keep builds green at every phase, use dual-build mode until route cutover:
1. **Phase 1-3 (coexistence)**:
   - `build:next` = `next build` (primary app build gate)
   - `build:start` = `vite build` for TanStack bootstrap scope only
   - `build` remains `pnpm run build:next`
2. **Phase 4 (route cutover)**:
   - flip `build` to `pnpm run build:start`
   - keep `build:next` temporarily for one verification cycle
3. **Phase 7 (cleanup)**:
   - remove `build:next` and all Next-only build paths

This avoids the invalid state where Vite is forced to build unresolved Next-only modules.

## 3. Global Quality Gates (Every Phase)
1. `pnpm lint` must pass.
2. Active phase build gates must pass:
   - Phase 1-3: `pnpm run build:next` and `pnpm run build:start`
   - Phase 4-8: `pnpm build` (TanStack/Vite build)
3. No newly introduced TypeScript errors.
4. No broken route links in navigation/footer.
5. No Next.js runtime dependency introduced in newly migrated code.
6. Provide owner handoff:
   - changed files list,
   - executed checks,
   - manual test checklist for the phase.
7. Starting from Phase 3, run Workers runtime checks (`wrangler dev` smoke) in every phase.

## 4. Current-to-Target Mapping

### 4.1 Runtime/Build
1. Current: Next.js + `@cloudflare/next-on-pages` + Pages deploy.
2. Target: TanStack Start + Vite + `@cloudflare/vite-plugin` + `wrangler deploy` to Workers.

### 4.2 API
1. Preserve `/api/*` endpoints and high-level payload behavior.
2. Keep endpoint paths:
   - `/api/categories`
   - `/api/log`
   - `/api/log/all`
   - `/api/log/refine`
   - `/api/log/submit`
   - `/api/log/[id]`
   - `/api/log/[id]/categories`
   - `/api/script`
   - `/api/telegram/[id]`
   - `/api/trigger/[id]`
   - `/api/trigger/images`
   - `/api/upload/[id]`

### 4.3 Routes
1. Keep app routes:
   - `/`
   - `/explore`
   - `/new`
   - `/:id`
   - `/:id/edit`
   - 404 behavior
2. Remove nav/footer links for non-existent pages.

### 4.4 Env Normalization
Use Vite-style names for client-exposed values:
1. `NEXT_PUBLIC_APP_URL` -> `VITE_APP_URL`
2. `NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL` -> `VITE_CLOUDFLARE_PUBLIC_URL`
3. `NEXT_PUBLIC_CLOUDFLARE_DEPLOY_URL` -> `VITE_CLOUDFLARE_DEPLOY_URL`

Server-only secrets remain non-`VITE_`:
1. `TURSO_DATABASE_URL`
2. `TURSO_AUTH_TOKEN`
3. `OPENAI_API_KEY`
4. `ACCESS_KEY_ID`
5. `SECRET_ACCESS_KEY`
6. `ACCOUNT_ID`
7. `SECRET`
8. `TELEGRAM_BOT_API_KEY`
9. `TELEGRAM_BOT_CHAT_IDS`
10. `CLOUDFLARE_IMAGE_TOKEN`

### 4.5 Dependency Disposition
1. `sharp`:
   - not used directly by app code,
   - keep only while Next/image path still exists,
   - remove by Phase 7 at latest (prefer Phase 5 once `<img>` migration is done).
2. `vercel` CLI package:
   - currently unused by active scripts,
   - remove in Phase 1 or Phase 7 (must be removed before final state).
3. AI SDK compatibility:
   - keep current `@ai-sdk/openai` and `ai`,
   - treat Workers compatibility as validated only after runtime smoke in Phase 3+.

### 4.6 Cache/ISR Replacement Strategy (Explicit)
Current Next ISR primitives:
1. `export const revalidate = 60` (home/explore)
2. `export const revalidate = 7200` (detail)
3. `revalidatePath('/', 'layout')` after mutations

Migration strategy:
1. Phase 3-4: correctness-first, no ISR emulation; serve fresh SSR/data (`no-store` behavior).
2. `revalidatePath` calls are replaced by explicit domain operations only (no Next cache API usage).
3. `regenerateContents()` is refactored away from framework cache invalidation.
4. Optional edge caching policy (Cache API / cache headers) is deferred and documented in backlog.

Rationale: avoids hidden stale-content bugs during framework migration; performance cache work is a dedicated follow-up.

### 4.7 `nuqs` Migration Strategy
1. Remove `nuqs/adapters/next/app`.
2. Use `nuqs/adapters/tanstack-router`.
3. Preserve current query parameter names and semantics.
4. Validate URL-state behavior on `/explore` manually in each relevant phase.

### 4.8 Domain and Worker Naming Strategy
1. Canonical post-migration endpoint: `https://purranormal-activity.workers.dev`.
2. Use worker name `purranormal-activity` (correct typo from legacy `purranormal-actvivity`).
3. Create/use the correctly named worker as migration target.
4. No redirect/custom-domain rollout in this migration scope.

## 5. Macro Phases

## Phase 1 - Foundation and Toolchain Bootstrap
### Goal
Introduce TanStack Start + Cloudflare Workers toolchain in repo without breaking baseline workflows.

### Required Code Output
1. Add TanStack Start/Vite base setup files.
2. Add Workers config for TanStack Start deployment:
   - prefer `wrangler.jsonc`,
   - `name: "purranormal-activity"`,
   - `compatibility_date: "2026-02-24"`,
   - `compatibility_flags: ["nodejs_compat"]`,
   - `main: "@tanstack/react-start/server-entry"`.
3. Update scripts toward target (`dev`, `build`, `preview`, `deploy`, `cf-typegen`) while preserving version bump behavior on dev.
   - introduce dual build scripts (`build:next`, `build:start`) per Section 2.2
4. Update Node 22 alignment:
   - `.nvmrc`,
   - CI workflow node version,
   - optional `engines` in `package.json`.
5. Remove clearly obsolete deployment deps/tooling if not needed in coexistence mode:
   - prefer removing `vercel` CLI early.

### Validation
1. `pnpm install`
2. `pnpm lint`
3. `pnpm run build:next`
4. `pnpm run build:start`

### Done Criteria
1. Toolchain compiles.
2. Lint/build green.
3. No route behavior changes yet.

## Phase 2 - Shared Core Extraction (Decouple from Next)
### Goal
Remove type and utility coupling to Next before page/API migration.

### Required Code Output
1. Extract API request/response/body types from route files into shared modules (e.g. `types/api/*`).
2. Remove `types/next.ts` dependency patterns and replace with framework-neutral equivalents.
3. Replace Next-specific cache utility wrappers (`utils/next.ts`) with framework-neutral service functions (temporary no-op or adapter-ready layer).
4. Keep business logic in `services/*`, `utils/*`, `db/*` intact.

### Validation
1. `pnpm lint`
2. `pnpm run build:next`
3. `pnpm run build:start`

### Done Criteria
1. No app code importing types from Next route files.
2. Shared core ready for TanStack adapters.

## Phase 3 - HTTP API Migration to TanStack Start
### Goal
Port all `/api/*` handlers to TanStack Start server routes while preserving behavior.

### Required Code Output
1. Implement all current endpoints under TanStack Start route system.
2. Preserve method support and payload semantics.
3. Keep current generation trigger behavior and redeploy logic.
4. Keep current edit/delete secret flow behavior.
5. Maintain current polling compatibility for client consumers.
6. Replace self-HTTP server recursion where possible:
   - refactor `regenerateContents()` and image-trigger orchestration to direct server-side function calls.
   - keep fallback HTTP path only where strictly needed.

### Validation
1. `pnpm lint`
2. `pnpm run build:next`
3. `pnpm run build:start`
4. Manual endpoint smoke checks with curl/postman for each endpoint.
5. `wrangler dev` runtime smoke for migrated API routes.

### Done Criteria
1. All `/api/*` routes reachable and functionally equivalent for current frontend.
2. Lint/build green.

## Phase 4 - Route Migration (UI Pages + Data Flow)
### Goal
Migrate user-facing routes from Next App Router to TanStack Start routes/loaders/actions.

### Required Code Output
1. Port routes:
   - `/`
   - `/explore`
   - `/new`
   - `/:id`
   - `/:id/edit`
   - not found route
2. Keep current query semantics for explore filters.
3. Keep detail/edit behavior and easter egg.
4. Remove links to `/discover`, `/stats`, `/secrets` from UI.
5. Migrate `nuqs` adapter to `nuqs/adapters/tanstack-router`.
6. Perform build flip:
   - set `build` to TanStack (`build:start`)
   - retain `build:next` for one temporary verification cycle.

### Validation
1. `pnpm lint`
2. `pnpm run build:next`
3. `pnpm build`
4. Manual navigation checks across all routes.
5. `wrangler dev` runtime smoke for core page routes.

### Done Criteria
1. Full route parity working on TanStack Start.
2. No broken internal links.

## Phase 5 - Replace Next-Specific Client/Rendering Features
### Goal
Eliminate Next runtime APIs and preserve UX behavior.

### Required Code Output
1. Replace `next/image` usage with `<img>` based components.
2. Replace `next/navigation` and `next/link` usage with TanStack equivalents.
3. Replace `next/font` integration while preserving Quicksand + Caveat rendering.
4. Implement metadata/head equivalents for SEO on detail/explore/home routes.
5. View transitions: implement best-effort equivalent; if unstable, gracefully disable.
6. Preserve image generation polling interval (`500ms`) behavior.
7. Remove `next/image` runtime path so `sharp` is no longer required.

### Validation
1. `pnpm lint`
2. `pnpm build`
3. Manual UX pass on home/explore/new/detail/edit.
4. `wrangler dev` runtime smoke for image/status flows.

### Done Criteria
1. No runtime `next/*` usage in active app code.
2. UX parity acceptable with best-effort transitions.

## Phase 6 - Env/Config Normalization + Workers Wiring
### Goal
Finalize Vite env migration and Workers runtime compatibility.

### Required Code Output
1. Normalize public env names from `NEXT_PUBLIC_*` to `VITE_*`.
2. Update env modules and all call sites.
3. Ensure Workers runtime access pattern is correct for server code.
4. Add/update `cf-typegen` flow and verify generated worker types usage where needed.
5. Keep single-env setup but make configuration explicit and deterministic.

### Validation
1. `pnpm lint`
2. `pnpm build`
3. `pnpm run cf-typegen`
4. local run against prod-like env values.
5. `wrangler dev` runtime smoke with real env bindings.

### Done Criteria
1. Env usage is consistent and documented.
2. Workers-compatible app runs locally and builds cleanly.

## Phase 7 - Cleanup of Next/Pages Residue
### Goal
Remove obsolete Next.js and Pages-era files/dependencies in same migration track.

### Required Code Output
1. Remove Next-only files/config/deps not needed anymore:
   - `next.config.ts`,
   - `next-env.d.ts`,
   - `@cloudflare/next-on-pages`,
   - `next`,
   - `next-view-transitions`,
   - `sharp`,
   - `vercel`,
   - other Next-only remnants.
2. Remove Pages deployment artifacts from scripts/config.
3. Ensure references to `.vercel`, `.open-next`, `.next` are not required by active workflows.
4. Keep repository clean and focused on TanStack Start + Workers.

### Validation
1. `pnpm lint`
2. `pnpm build`
3. `pnpm run deploy` dry-run or equivalent sanity check.
4. `wrangler dev` final runtime smoke.

### Done Criteria
1. No Next dependency in active runtime/build path.
2. Build/deploy commands target Workers only.

## Phase 8 - Final Regression Pass and Owner Handoff
### Goal
Stabilize migration output and provide clear handoff for owner testing/commit.

### Required Code Output
1. Fix remaining regressions and lint/build issues.
2. Ensure manual test checklist from `wiki/manual-test.md` core flows is passable on migrated app:
   - home load,
   - explore filters,
   - new log flow,
   - detail/edit flow,
   - notification trigger.
3. Update README commands and deployment instructions.

### Validation
1. `pnpm lint`
2. `pnpm build`
3. `pnpm run preview` (or local workers preview command)
4. owner manual checks.

### Done Criteria
1. Migration complete and usable on `purranormal-activity.workers.dev`.
2. Owner can test and commit phase outputs incrementally.

## 6. LLM Operating Protocol
Use this protocol for every phase execution:
1. Read this file and phase scope only.
2. Implement code changes for current phase only.
3. Run validation commands.
4. If checks fail, fix in same phase before handoff.
5. Produce concise handoff:
   - what changed,
   - what was validated,
   - manual checks for owner,
   - known caveats.
6. Do not commit.
7. Wait for owner validation before next phase.

## 7. Reusable Prompt Template for Future Executor LLM
```text
You are implementing Phase <N> from /plan.md in this repository.
Rules:
- Execute only Phase <N> scope and required outputs.
- Keep behavior parity and minimize regressions.
- Keep lint/build green using phase-specific gates from Section 3.
- Do not commit.
- Provide handoff summary with changed files, checks run, and manual QA steps.
- If blocked, provide exact blocker and smallest safe fallback.
```

## 8. Non-Goals for This Migration
1. No comprehensive automated test suite implementation.
2. No auth redesign/security hardening expansion.
3. No cron/queues/workflows platform features.
4. No architecture rewrite beyond what is needed for migration and parity.
