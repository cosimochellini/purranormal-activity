# Feature Specification: StoryForge Module Consolidation

**Feature Branch**: `005-storyforge-consolidation`
**Created**: 2026-04-26
**Status**: Draft
**Input**: GitHub issue #7 — RFC: Consolidate prompts + category cache into StoryForge module

## User Scenarios & Testing *(mandatory)*

> The "users" of this feature are (a) developers maintaining the AI generation pipeline and (b) end users of the public site who today can experience a silent data-loss bug when AI generation fails.

### User Story 1 — Submitting a paranormal event when AI fails (Priority: P1)

A site visitor submits an event on `/new`. The OpenAI service is rate-limited or unreachable. Today, the site silently inserts an empty log row (blank title, blank description) into the database and returns a misleading success response. After this change the visitor receives a clear "AI assistant is temporarily unavailable" message and **no log row is created**.

**Why this priority**: This is a real, in-production data-integrity bug. Empty rows pollute the explore feed and the search index. P1 because it directly affects the public site.

**Independent Test**: Stub the AI provider to throw a network error; submit a valid event payload to `POST /api/log/submit`; assert the response is `{ success: false }` with a friendly error and that the `log` table row count is unchanged.

**Acceptance Scenarios**:

1. **Given** the AI provider is unreachable, **When** a visitor submits a valid event, **Then** the response indicates failure with a friendly message AND no row is inserted into `log`.
2. **Given** the AI provider returns malformed JSON, **When** a visitor submits a valid event, **Then** the response indicates failure AND no row is inserted.
3. **Given** the AI provider responds successfully, **When** a visitor submits a valid event, **Then** the response indicates success AND a fully-populated row is inserted.

---

### User Story 2 — Maintaining the prompt module (Priority: P2)

A developer needs to tweak the wording of the Italian prompt for `generateLogDetails`. Today they grep across `services/ai.ts`, `services/prompts.ts`, and `services/categories.ts`, working out which functions touch which prompts and why two of the four AI methods return defaults on error while the other two throw. After this change they edit a single file inside `services/storyForge/`, the prompt is private to the module, and a snapshot test assures they didn't accidentally change unrelated copy.

**Why this priority**: Improves maintainability and reduces the risk of prompt-regression bugs slipping through review. P2 because it does not affect production behaviour directly.

**Independent Test**: Open `services/storyForge/prompts.ts`, change one wording detail, run `pnpm test` — the inline snapshot test for that one prompt fails with a clear diff while all other prompt snapshots stay green.

**Acceptance Scenarios**:

1. **Given** the developer is editing a prompt template, **When** they run the test suite, **Then** the inline snapshot for that prompt fails with a diff, and all other intent-method snapshots remain green.
2. **Given** the developer is searching for the prompt strings, **When** they grep the public service surface, **Then** prompt strings are NOT visible — only intent method names.

---

### User Story 3 — Consistent error handling for the four AI intents (Priority: P2)

A developer adding a new caller of an AI generation method (for example, a future "regenerate description" admin action) needs a predictable error contract. Today, two methods return a sentinel default object on failure while two throw — there is no compile-time signal to remind callers to handle errors, and the union shape of the success/error returns is inconsistent.

**Why this priority**: Prevents the next instance of the empty-log-insert bug from being shipped. P2 because the immediate bug is fixed by P1; this addresses the underlying design.

**Independent Test**: A new caller writes `const r = await storyForge.imagePrompt(text)`; the type system requires them to discriminate on `r.ok` before accessing `r.value`. Forgetting to check `r.ok` is a compile error.

**Acceptance Scenarios**:

1. **Given** a developer calls any of the four StoryForge intent methods, **When** they try to access the success value without checking the discriminator, **Then** TypeScript reports an error.
2. **Given** the AI provider fails, **When** a caller checks `r.ok`, **Then** they receive a `{ ok: false, error: 'parse' | 'model' | 'validation', message: string }` shape with which to map to user-facing copy.

---

### Edge Cases

- AI provider throws a non-Error value (string, undefined). The error envelope must still produce a printable `message`.
- AI provider returns a 200 response with empty body. The empty body is treated as a `parse` error (JSON.parse of an empty string throws). Empty arrays from `createQuestions` (already legitimate today) remain a successful empty list, NOT a validation failure.
- Category list is empty when `logDetails` is called. The cache must not memoize an empty result as if it were a successful fetch — the next call must re-attempt (matches today's `services/categories.ts:13` behaviour).
- `invalidateCategories()` is called concurrently with an in-flight `categories.all()`. The next caller after invalidation MUST see fresh data (i.e., invalidation overrides any in-flight memoization promise).
- Telegram message generation returns text wrapped in ` ```html ... ``` ` fences. The fences MUST be stripped before being delivered to Telegram (preserves current `removeHTMLTags` behaviour).
- A caller of `services/notifier` only knows the `composeMessage` port returns `Promise<string>`. The default StoryForge-backed adapter must convert `{ ok: false }` into a thrown error so notifier's existing fan-out catch path still fires.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a single public deep module `services/storyForge` providing four prompt-driven intent methods: `questions`, `logDetails`, `imagePrompt`, `telegramMessage`, plus an `invalidateCategories` operation.
- **FR-002**: Every intent method MUST return a discriminated union of the form `{ ok: true; value: T }` OR `{ ok: false; error: 'parse' | 'model' | 'validation'; message: string }`. No method may throw on AI failure paths.
- **FR-003**: Prompt strings MUST be private to the StoryForge module — no other module may import them.
- **FR-004**: Category lookup MUST be cached behind a port whose only public operations are `all()` and `invalidate()`. The `__resetCategoryCache()` test backdoor MUST be deleted; tests inject a stub via `createStoryForge({ categories })`.
- **FR-005**: `POST /api/log/submit` MUST NOT insert a `log` row when `storyForge.logDetails` returns `{ ok: false }`.
- **FR-006**: `POST /api/log/refine` MUST continue to map error envelopes to the same user-facing message families it produces today (`mystical AI assistant`, `connection issue`, `request took too long`).
- **FR-007**: `services/trigger.ts` MUST continue to allow `services/script.ts` per-log catch behaviour by throwing on `{ ok: false }` from `imagePrompt` (preserving today's contract upstream of the refactor).
- **FR-008**: `services/notifier`'s `composeMessage` port signature MUST remain `(event) => Promise<string>` so existing notifier tests are unchanged. The default StoryForge-backed adapter unwraps the AIResult and rejects on `{ ok: false }`.
- **FR-009**: The non-prompt-driven function `generateImageBase64` MUST be moved to `services/imageGen.ts` and continue to throw on failure (preserving its current contract).
- **FR-010**: Inline snapshot tests MUST cover the rendered prompt for each of the four intent methods, asserted via `toMatchInlineSnapshot()`.
- **FR-011**: Cache lifecycle tests MUST cover (a) `categories.all()` is called once across N intent invocations, (b) `categories.all()` is called again after `invalidateCategories()`.
- **FR-012**: After this change, the files `services/ai.ts`, `services/prompts.ts`, `services/categories.ts`, and their test counterparts MUST no longer exist.

### Key Entities

- **AIResult\<T\>**: discriminated union encoding success-or-failure of an AI generation intent.
- **StoryForge**: the deep module's public surface; an interface with four intent methods + `invalidateCategories`.
- **Deps** (internal, NOT exported): the contract of dependencies the module owns — `categories: { all(); invalidate() }`, `llm: { text({ model, prompt }) }`, `randomStyle()`.
- **LogDetails**, **QuestionSpec**, **Answer**: shape contracts returned by intent methods.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When the AI provider fails during `POST /api/log/submit`, the count of rows in the `log` table after the request is identical to the count before the request (zero data-integrity loss).
- **SC-002**: A code search for `from '@/services/prompts'` or `from '@/services/categories'` returns zero results in the public service surface (i.e., outside the StoryForge directory) after this change ships.
- **SC-003**: A developer who edits any of the four prompt templates sees exactly ONE failing snapshot test corresponding to the prompt they edited; unrelated prompts remain green.
- **SC-004**: Compile errors are produced when a new caller forgets to discriminate on `r.ok` before accessing `r.value` — verified by intentionally writing a misuse and observing `pnpm typecheck` fail.
- **SC-005**: The full test suite (`pnpm test`) passes, the linter (`pnpm lint`) reports zero issues, the type checker (`pnpm typecheck`) reports zero errors, and the production build (`pnpm build`) succeeds.
- **SC-006**: A multi-agent code review (`/gh-pr-no-checkout-review`) of the resulting PR reports zero P0, P1, and P2 findings.

## Assumptions

- Categories are effectively immutable at runtime today; production never invalidates the cache. The new explicit-only TTL-less invalidation matches existing behaviour and is intentional.
- The Italian wording of all four prompts is preserved verbatim — this refactor is purely structural.
- The two model identifiers in use (`gpt-5-mini`, `gpt-5.2`) and the image model (`gpt-image-1.5`) remain unchanged.
- Routes (`/api/log/refine`, `/api/log/submit`, `/api/trigger/$id`) keep their existing user-facing error copy and only swap from `try/catch on throw` to `if (!r.ok)` discrimination.
- The notifier's outer try/catch continues to absorb thrown AI failures; the AIResult-unwrapping adapter at the default `composeMessage` boundary preserves that behaviour.
- No multi-language or A/B prompt variant infrastructure is built now; the module structure leaves room to add it later without touching call sites.
- No new public HTTP endpoint is added for cache invalidation; `invalidateCategories()` is exposed only on the module surface for tests and future cron-driven refreshes.
