# Deferred Backlog (Not in Current Migration Scope)

This backlog is ordered and intentionally excluded from the current migration scope.

## 1) Technical Backlog
1. Add automated tests (unit + integration + E2E) for core flows (`/`, `/explore`, `/new`, `/:id`, `/:id/edit`, `/api/*`).
2. Introduce API contract tests to lock payload compatibility and prevent accidental regressions.
3. Replace permissive `200`-on-error API responses with proper HTTP status semantics and structured error model.
4. Add request rate limiting for AI-heavy and notification endpoints (`/api/log/refine`, `/api/log/submit`, `/api/trigger/*`, `/api/telegram/*`).
5. Add robust env validation at boot (zod schema + fail-fast startup errors).
6. Add auth/authorization layer for edit/admin actions (instead of secret-only form flow).
7. Replace polling-based image refresh (500ms reload) with a less expensive status update mechanism.
8. Migrate image generation orchestration from trigger+redeploy to a proper job queue/workflow.
9. Add observability stack: structured logging, error reporting, trace IDs, request metrics.
10. Add production runbooks for incidents (OpenAI failures, Turso outages, R2 upload errors, Telegram failures).
11. Add retry/backoff policies and idempotency keys for write endpoints.
12. Add DB migration safety flow (staging-like checks, rollback strategy, schema drift detection).
13. Introduce stricter TypeScript project boundaries and shared API contract modules.
14. Revisit `npm version patch` on each `dev` run (high noise in versioning).
15. Optimize large component files into smaller feature modules after migration stabilizes.
16. Replace `<img>` with a production-grade responsive image optimization strategy compatible with Workers.
17. Harden CSP/security headers and baseline OWASP checks.
18. Add dependency/update automation and vulnerability scan checks in CI.
19. Add Workers-specific performance budgets and regression monitoring.
20. Define multi-environment strategy (dev/staging/prod) when team/process requires it.

## 2) Product and UX Backlog
1. Reintroduce removed menu/footer destinations as real features (`Discover`, `Stats`, `Secrets`) or redesign navigation IA.
2. Improve view transitions quality and consistency across browsers/devices.
3. Add explicit loading and error states harmonized across all routes and forms.
4. Improve accessibility baseline (keyboard interactions, ARIA audits, contrast checks, screen reader flow).
5. Add richer Explore UX (saved filters, better empty states, applied filter badges, reset controls).
6. Add admin/category management UX for missing categories flow (review/approve/edit).
7. Add event timeline/history features and richer sorting dimensions.
8. Improve notification UX (delivery feedback, retries, history, per-channel controls).
9. Add user-facing status for image generation pipeline (queued/processing/failed/retry).
10. Add localization strategy if multilingual support becomes relevant.
11. Plan and execute domain transition from legacy `*.pages.dev` endpoint (redirects/custom domain strategy).

## 3) Documentation Backlog
1. Add an architecture decision record (ADR) for the migration choices and tradeoffs.
2. Add endpoint reference docs (`/api/*`) with request/response examples.
3. Add local setup guide for prod-like development with real service integrations.
4. Add troubleshooting docs for Cloudflare Workers deploy/runtime issues.
5. Add maintenance guide for future framework upgrades (TanStack Start, Vite, Wrangler).
