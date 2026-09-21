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
- A **custom `rating` field type** registered in the playground, which proves the plugin system works for an outside consumer (docs page shows the same code).
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
