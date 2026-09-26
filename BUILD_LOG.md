# Formora — Build Log

A running record of what's actually been built, in plain language. Updated as each feature/module ships, starting from Phase 1 (see [ROADMAP.md](./ROADMAP.md) for the plan; this file records what actually happened).

Each entry: what was done, what it enables, anything worth remembering about how it works.

---

## Phase 1 — `@hardikrastogi/core` schema & validation engine

**What was built:**
- `FormDefinition` schema (`src/schema/form-definition.ts`) — the blueprint object for a form: `fields`, `layout` (12-column grid), `theme` (design tokens), `logic` (conditional visibility + calculated fields), plus metadata (`id`, `name`, `schemaVersion`, `createdAt`, `updatedAt`).
- `FormSubmission` schema (`src/schema/form-submission.ts`) — `{ formId, schemaVersion, answers, meta }`, what gets created when a respondent submits a form.
- Field-type plugin interface + registry (`src/plugin.ts`) — the `{ type, schema, defaultProps, Editor, Renderer, validate }` contract every field type (text, KYC, etc.) will implement later. Kept framework-agnostic (no React import) so `core` stays usable outside React.
- Validation engine (`src/validation.ts`) — `validateSubmission(definition, answers)` checks required fields and per-field rules (minLength/maxLength/min/max/pattern), returns `{ success, errors }` with field-level messages.
- Schema versioning helpers (`src/versioning.ts`) — `isSubmissionCurrent` and `bumpSchemaVersion`, the mechanism that lets an old submission stay valid even after its form has since changed.
- Structural safety checks built into `FormDefinitionSchema` itself: rejects duplicate field IDs, layout rows whose column spans exceed 12, layout/logic referencing a field ID that doesn't exist.
- 10 Vitest unit tests covering both the schema (`form-definition.test.ts`) and the validation engine (`validation.test.ts`) — all passing.

**What this enables:** any consumer (the future renderer, builder, or a hand-written test) can now construct a `FormDefinition`, validate it structurally, and validate a set of answers against it — with zero UI involved.

**Published:** `@hardikrastogi/core@0.1.0` is live on npm.

---

## Phase 2 — `@hardikrastogi/react` headless renderer

**What was built:**
- `<FormRenderer definition onSubmit />` and the `useFormRenderer` hook underneath it (`packages/react/src`). Give it a `FormDefinition` and it draws a working, validated form; `onSubmit` receives clean answers keyed by field id (empty values dropped, numbers are real numbers, checkboxes are booleans).
- 8 built-in field types: text, email, number, select, date, checkbox, radio, textarea. Registered through `createDefaultRegistry()`, so custom types register the same way.
- The definition is parsed with core's `FormDefinitionSchema` first. Hand-written JSON gets its defaults applied, and an invalid definition renders a readable error instead of crashing.
- Validation uses one source of truth: core's `validateSubmission` plus each field type's own `validate` (email format), wired into react-hook-form as a resolver. On a failed submit the first invalid field is focused.
- Layout: each row is a 12-column CSS grid; a field's `span` becomes `--df-span`; columns stack on narrow screens. Fields that the layout forgot are still rendered.
- Theming: `theme` becomes CSS variables (`--df-primary`, `--df-radius`, `--df-gap`, `--df-font`, ...) on the single `.df-form` element. Per-field `style` becomes `--df-field-*` variables on that field only. `classNames` lets consumers add classes per slot.
- Unknown field types render a clear "Unsupported field type" placeholder.
- Ships `dist/styles.css` (import `@hardikrastogi/react/styles.css` once) and a `"use client"` banner so it works in Next.js without any Next.js import.

**Core changes made along the way (`@hardikrastogi/core` 0.2.0):**
- Added optional per-field `style` (`textColor`, `backgroundColor`, `borderColor`, `radius`, `fontSize`).
- Field ids are now restricted to safe identifiers (`^[A-Za-z][A-Za-z0-9_-]{0,63}$`, no `__proto__`) because react-hook-form treats `.` in a name as a nested path.
- A required checkbox that is unticked, or a required list that is empty, now counts as missing.
- Exported the `FormDefinitionInput` type (the shape before defaults are applied).

**Decisions:**
- CSS variables are prefixed `--df-` to match the `.df-` class prefix (the original spec mentioned `--fc-`; the two prefixes disagreed).
- Select uses a native `<select>` instead of Radix Select: better on mobile, fully accessible, no extra dependency, and simple to test.
- The number field keeps its own text state so typing `-` or `1.` doesn't get wiped mid-edit.

**Tests:** 12 component tests (Vitest + Testing Library) plus 13 in core, all passing.

**Not yet done:** real-browser Playwright test (waits for the Phase 3 playground page), and publishing. Nobody has looked at the styled result in a real browser yet.

---

## Phase 3 — Next.js docs site and playground (`apps/web`)

**What was built:**
- A Next.js 16 (App Router) app with Tailwind 4 and shadcn/ui. shadcn lives only here, never in the published packages. The app depends on `@hardikrastogi/core` and `@hardikrastogi/react` through the workspace, so it always runs the local source of both.
- **Landing page** (`/`): what Formora is, install and usage snippets, how it works, and an honest status note (0.x, builder and hosting are planned).
- **Docs** (`/docs/*`, 8 pages): introduction, installation, quickstart, FormDefinition reference, field types, theming, custom field types, API reference. The quickstart definition was checked against the real schema before writing it down.
- **Playground** (`/playground`): edit a FormDefinition as JSON and the form re-renders as you type; three examples; Format, Copy and Reset; on submit it shows the exact FormSubmission a backend would receive. Broken JSON keeps the last valid preview and shows the error. Valid JSON that is not a valid form shows the schema problem. On phones the editor and preview switch with tabs.
- A **custom `rating` field type** registered in the playground, which proves the plugin system works for an outside consumer (docs page shows the same code). *(Superseded 2026-09-24: `rating` became a real built-in type; the custom-field demo moved to a `slider` field — see that entry below.)*
- **Tests:** 37 Playwright tests run against a production build in real Chromium: docs pages, the whole fill-in-and-submit flow, validation, live editing, error states, plugin field, phone layout with no sideways scrolling, and axe accessibility scans of 5 pages. Run with `pnpm test:e2e` from the repo root.

**Bugs found by looking at it in a real browser and fixed:**
- Focus after a failed submit was timing dependent (worked on React 18 by luck, failed on React 19). Now runs in an effect after the errors render.
- Picking a playground example briefly flashed the previous example. Cause was deferring the JSON parse. Removed the deferral.
- Code blocks failed contrast and keyboard-scroll accessibility checks; a themed background had no inner padding (fixed in the react package: setting a background now adds padding).
- shadcn generated a circular font variable, and Next's `LayoutProps` type only exists after a build; replaced with explicit types.

**Decisions:**
- React is on 19 everywhere in the workspace (the react package tests moved from 18 to 19) so there is exactly one React copy.
- Plain textarea for the JSON editor rather than Monaco or CodeMirror: much lighter, good enough for now.
- Docs are plain TSX pages, not MDX: fewer moving parts.
- Light theme only for the site for now.

**Not done yet (needs you):** publishing core `0.2.0` and react `0.1.0` to npm, and deploying to Vercel. Until the packages are published, the install command on the site will not work for outside visitors.

---

## Phase 4 — `@hardikrastogi/builder` drag-and-drop authoring UI

**What was built:**
- A Zustand store (`src/store.ts`) holding the live `FormDefinition` while building. Every action (`addField`, `removeField`, `updateField`, `reorderFields`, `setFieldSpan`, `setTheme`, `setFormName`) goes through Immer, so it's written as if mutating directly. Undo/redo works by snapshotting the whole definition before each change (capped at 50 steps) — simpler than Immer's inverse-patch approach and just as correct at this size.
- **Three-panel UI**: `Palette` (left, field types grouped by category with search, click-to-add or drag-to-add), `Canvas` (center, drag to reorder via dnd-kit, click a field to select it, delete button per field), `Inspector` (right, four tabs — Basic / Validation / Logic / Style — for whatever's selected, or the form-wide theme when nothing is).
- **`TopBar`**: form name, Undo/Redo, a Theme button (deselects the current field so the theme tab is reachable — added after testing showed no other way back to it), a Preview/Edit toggle, a disabled Share button (arrives with Phase 5), and a save-state indicator.
- **Preview mode** swaps the three panels for the real `@hardikrastogi/react` `FormRenderer`, rendering the actual current definition — not a mockup.
- **WCAG AA contrast check** (`src/contrast.ts`): computes the real relative-luminance contrast ratio between the chosen primary colour and white button text, and shows an inline warning with the actual ratio when it's below 4.5:1.
- **Autosave** (`src/use-autosave.ts`) debounces writes to `localStorage`, explicitly documented as a stand-in for the Phase 5 backend autosave, not the real thing.
- Wired into `apps/web` at `/builder` (client-only, since it reads `localStorage`) plus a `/docs/builder` reference page.

**Bugs found by actually clicking through it (not just unit tests) and fixed:**
- **Crash on Undo/Redo**: undoing past a field's creation left `selectedFieldId` pointing at a field that no longer existed, and the Inspector's `field!` non-null assertion crashed the whole app on render. Fixed in the store (undo/redo clear the selection when it no longer resolves) and hardened the Inspector to never assume the selected field still exists.
- **No way back to the theme tab**: once a field was selected, there was no way to deselect it and see form-wide theme settings again except deleting the field. Added a `Theme` button in the top bar and made clicking empty canvas space deselect too.
- **Accessibility, found by an automated scan of the real page**: a `<main>` nested inside the page's own `<main>` landmark, two unlabeled `<aside>` landmarks with the same implicit role, and the palette's category headings jumping from `<h1>` straight to `<h3>`. All three fixed (the panel divs are no longer landmarks, the asides got `aria-label`s, and the category headings are now `<h2>`).

**Tests:** 29 Vitest/Testing Library tests (11 for the store's logic including undo/redo edge cases, 4 for the contrast calculation, 14 for the full `Builder` component) plus 9 new Playwright end-to-end tests (adding fields, editing, required/validation, delete, undo/redo, preview, the contrast warning, and autosave surviving a page reload) — all passing, including an accessibility scan of the live `/builder` page.

**Not built yet:** dragging a field into an existing row to sit side-by-side with another (width is set numerically instead); the Logic tab is a placeholder until Phase 6; sharing and multi-device sync wait for Phase 5's real backend.

---

## 2026-09-24 — 5 more built-in field types: url, time, rating, country, currency

**What was built:**
- `@hardikrastogi/react` grows from 8 to 13 built-in field types:
  - `url` — text input, checks it is a valid `http(s)` URL.
  - `time` — text input of kind `time`, same pattern as the existing `date` field.
  - `rating` — a row of clickable stars (`radiogroup` of buttons), configurable via `defaultProps.max` (default 5).
  - `country` — a `<select>` pre-filled with a curated ~110-country list (ISO 3166-1 alpha-2 codes as the stored value); override `defaultProps.options` to replace it.
  - `currency` — a `<select>` pre-filled with ~34 common ISO 4217 currency codes; same override mechanism.
- All five registered in `createDefaultRegistry()`, so `defaultRegistry` now has 13 plugins.
- Builder palette (`packages/builder/src/field-catalog.ts`) updated to match: Website under Basic, Country/Currency under Choice, Time under Date & Time, Rating in a new Feedback category. The Inspector's Basic tab now hides the (meaningless) Placeholder field for `rating`, and shows the Options editor for `country`/`currency` too.
- `apps/web`: added an "International order" playground example exercising all five live; updated `/docs/field-types` (13 rows) and `/docs/api`.

**A naming collision, and how it was resolved:**
- `rating` was previously the playground's worked example of a *custom* field type (and the subject of the `/docs/custom-fields` tutorial). Promoting it to a real built-in would have made `registry.register(ratingPlugin)` throw (duplicate type) and made the tutorial self-contradictory (a "how to build a custom field" page demonstrating a field that ships built in).
- Fix: the custom-field demo was swapped to a **slider** (`type: "slider"`, a `<input type="range">`), registered only in `apps/web`. The tutorial's code sample, the playground's "Custom field + dark theme" example, and its e2e tests were all updated to match. `rating` is now a genuine built-in with no local registration needed anywhere.

**Tests:** 8 new Vitest tests in `@hardikrastogi/react` (one file per behavior: url validation, time input, rating stars + required check, country default list + override, currency), 2 new builder tests (palette lists all five; placeholder/options visibility per type), and 2 new + 2 updated Playwright end-to-end tests in `apps/web` (the international example submitting real values, a malformed-URL rejection, and the slider-based custom-field flow). All passing — 51 e2e tests total, up from 49.

---

## Phase 5a — Hosted forms: publish, share, and anonymous submissions

**What was built:**
- **Local MongoDB via Docker** (`docker run mongo:7`, `.env.local` → `MONGODB_URI`) for development; swapping to Atlas later is just changing that one value. `.env.example` documents both.
- **`apps/web/src/lib/db`**: a cached Mongoose connection singleton, and three models — `Form` (hosting metadata: slug, published, currentVersionId, plus not-yet-enforced anti-spam fields), `FormVersion` (an **immutable snapshot** of a `FormDefinition`, created on every publish), `Submission` (answers + a unique `formId + idempotencyKey` index so retries can't double-submit).
- **`POST /api/forms/publish`**: validates the definition with core's Zod schema, upserts the `Form` by slug (defaulting to the definition's own `id`), creates a new `FormVersion` snapshot, and marks it published — republishing the same slug just creates a new version.
- **`GET`-equivalent via `getPublishedFormBySlug`**: used by the public page; returns `null` (→ a 404) for a missing slug, an unpublished form, or a version whose stored JSON somehow fails to parse (fail closed, never render a broken form).
- **`POST /api/forms/[slug]/submit`**: re-validates server-side (never trusts the client), enforces `maxResponses` and `closesAt` if set, and is idempotent — a duplicate `idempotencyKey` returns the original submission instead of erroring or duplicating.
- **`POST /api/forms/[slug]/unpublish`**: stops new submissions (410) without touching the form or its existing data.
- **`/f/[slug]`**: a public page with `generateMetadata` producing real OG tags (title/description) from the form's name, rendering the published `FormRenderer` with no Formora account required.
- **Builder wiring**: `@hardikrastogi/builder`'s `Builder` component gained an `onPublish` prop (host-supplied, so the package itself still knows nothing about HTTP/Next.js) plus a Publish/Republish button, a live "Live at /f/slug" link, and a Share button (Web Share API, falling back to clipboard copy). `apps/web`'s builder page passes a `publishForm` function that calls the API.

**Real bugs found by actually running this against MongoDB, not just writing it:**
- **`FormVersion` creation failed** (`Path 'formId' is required'`) because the publish route tried to create the version *before* the `Form` existed, passing `formId: null`. Fixed by creating the `Form` first, then the version, then linking them.
- **Server-side validation had a real hole**: the submit route originally called only core's generic `validateSubmission` (required/min/max/pattern), missing the *type-specific* checks — a tampered request could submit `"not-an-email"` as a valid email, even though the browser blocks it. The email/url format checks actually live in `@hardikrastogi/react`'s field plugins, not in `core`.
- **Fixing that hole hit a second, architectural problem**: `@hardikrastogi/react`'s whole bundle is tagged `"use client"` (needed for `<FormRenderer>`), and Next.js refuses to import *anything* from a `"use client"` module in server code — even a plain function with zero React in it. Fixed properly: `packages/react/src/server-validation.ts` is now built as a **separate tsup entry with no `"use client"` banner**, published at `@hardikrastogi/react/server`, sharing the actual regex patterns (`fields/patterns.ts`) with the client components so the two can't drift apart. `collectServerErrors` is the new export the submit route uses.
- **The Share button had a latent crash**: `new URL(relativeUrl, window.location.origin)` throws if `origin` is ever not a valid absolute URL (confirmed via a real jsdom environment where `origin` is the literal string `"null"`) — with no `try/catch` around it, a user clicking Share in that situation would see nothing happen, silently. Wrapped in a fallback and an error message via the existing `publishError` state instead of failing silently.
- **A test-writing trap**: jsdom (as used here) already implements a real `Clipboard` object, so `Object.defineProperty(navigator, "clipboard", { value: ... })` silently doesn't take effect (a WebIDL proxy quirk) — `vi.spyOn(navigator.clipboard, "writeText")` (patching the existing object's method) is the correct way to mock it.

**Decisions:**
- **Draft/published split**: hosting metadata (`slug`, `published`, `accessMode`-to-come) lives entirely in Mongo's `Form`/`FormVersion`, never inside the portable `FormDefinition` JSON — so templates and exported JSON stay usable standalone, per the Phase 3 architecture decision.
- **Slug defaults to the definition's own `id`** rather than a separately-managed field — simplest thing that works before Phase 5b/5d add real multi-form management; documented as a known collision risk between unrelated forms that happen to share an id.
- **No creator ownership check yet** — anyone can currently republish any slug, since accounts don't exist until Phase 5b. Acceptable for now, not for production.

**Tests:** 7 new Vitest tests for `collectServerErrors`, 9 new/updated builder component tests (publish pending/success/error states, Share via Web Share vs. clipboard fallback, the origin-throws regression), and 9 new Playwright end-to-end tests running against a real MongoDB instance — publish, OG tags, required-field rejection, malformed-email rejection, idempotent retries, distinct-key separate submissions, unpublish→410, unknown-slug→404, and republish-with-a-new-required-field. Every hosted-forms e2e test uses its own randomly generated slug so parallel test workers sharing one database never collide. 60 e2e tests total, up from 51.

**Not built yet:** creator accounts (so anyone can currently publish/republish any slug — a real gap, closed in 5b), `verified_email`/`verified_phone` access modes (5c/5e), the response dashboard and CSV export (5d), and builder UI for the close-date/max-responses/one-response-per-respondent settings that already exist on the `Form` schema.
