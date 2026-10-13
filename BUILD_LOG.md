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

### Phase 5a follow-up — Unpublish button and docs

- **`Builder` gained `onUnpublish` and `initialPublished`** (both host-supplied, so the package still has no HTTP code). The top bar shows Unpublish next to Republish, a separate "Unpublishing…" busy state, and a note once unpublished. Publish state is not remembered by the builder itself; the demo page keeps the `PublishResult` in localStorage and passes it back, so Unpublish survives a reload.
- **Docs pages updated**: quickstart now uses `collectServerErrors` from `@hardikrastogi/react/server` (with the reason it is a separate entry), builder docs have a "Publishing and sharing" section, API reference lists the `/server` and builder exports.
- **Tests**: 7 new builder tests (42 total) and 1 new e2e test (unpublish, reload, republish). 61 e2e total.
- **Version**: `@hardikrastogi/builder` bumped to 0.3.0 (to be published by the owner).


---

## Phase 5b — Creator accounts

**What was built:**
- **Sign-in with an emailed magic link** (Auth.js v5 + MongoDB adapter, database sessions, no passwords). Pages: `/signin`, `/signin/check-email`, `/signout`. New addresses get an account automatically. Links are single-use and expire in 15 minutes.
- **Pluggable email delivery** (`lib/auth/send-magic-link.ts`, chosen by `EMAIL_TRANSPORT`): `console` prints the link in the terminal and stores it in a `dev_email_outbox` collection (local and e2e only), `resend` sends real email via Resend's HTTP API. Production refuses to start sending unless it is explicitly set, and the email provider's response body is never logged.
- **Ownership:** `Form.ownerAccountId` is set on first publish. Publish returns 401 signed out and 403 for someone else's link name; unpublish returns 404 for non-owners so slugs cannot be probed. Forms from before accounts are claimed by the first signed-in publisher.
- **Drafts:** new `Draft` model (unique per owner + form id) and `GET/PUT /api/drafts/[id]`. Saving is deliberately lenient (a half-edited form must save); publishing still runs the full schema check. `/dashboard` lists my forms, `/builder/new` starts one with a random id (which is also its default public link), `/builder/[id]` reopens one, and the bare `/builder` redirects to the dashboard.
- **`@hardikrastogi/builder` 0.4.0:** new `onSave` prop. With it, the debounced autosave goes to the host and the save indicator shows its result; edits made while a save is in flight are not marked saved. Without it the builder still uses localStorage.
- Header shows Sign in, or My forms and Sign out. It reads the session in the browser so the docs pages stay static.

**Decisions:**
- **Magic link only for now; Google is deferred.** Fewer moving parts to verify, and it needs no third-party app registration.
- **No middleware.** Each route handler and server page checks the session itself, which keeps auth code in one small helper and avoids Edge runtime limits with the database adapter.
- **Random form ids** for new forms, so two creators never fight over the same public link name.

**Real problems found by running it:**
- Auth.js builds sign-in links on `localhost` under `next start` regardless of the address the browser used, so an e2e suite browsing `127.0.0.1` never received the session cookie. The tests now use `localhost`.
- A server action that redirected back to the same page with an error in the URL silently did nothing; the form now uses `useActionState` and shows the error inline.
- My first pages were created one folder too high (`src/signin` instead of `src/app/signin`), so the sign-in page 404ed until moved.
- The disk filled up (turbo's build cache had grown to 1.4 GB), which made unrelated e2e tests fail with `ENOSPC`. Not a code bug; cache cleared.

**Tests:** 2 new builder tests (44 total), 10 new e2e tests (sign-in redirect, real magic-link flow including single-use, invalid email, open-redirect guard, 401s, cross-account ownership and draft privacy, draft id checks, dashboard listing, autosave failure display, accessibility of builder and dashboard). Existing e2e tests now sign in first. 71 e2e tests total.

**Not built yet / owner tasks:** Resend account and a verified domain (SPF/DKIM) so production emails deliver; Vercel env vars `AUTH_SECRET`, `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `EMAIL_FROM`; Google sign-in; account settings/deletion; rate limiting on sign-in requests.

---

## Phase 5b-2 — Password and Google sign-in for creators

**What was built:**
- **Email+password signup**, gated behind a single-use, 15-minute email verification link (`AccountVerificationToken`, shaped like 5c's respondent challenges: hashed tokens, per-purpose rate limits — 60s cooldown, 5/hour per email, 20/hour per IP). The password is hashed *before* the email is sent and held on the unconsumed token (`pendingPasswordHash`); nothing touches the `users` collection until the link is actually clicked.
- **Email+password login** via a NextAuth Credentials provider, plus a forgot-password flow (single-use reset link; the old password stops working the instant a new one is set).
- **"Continue with Google"** (NextAuth's Google provider), auto-hidden everywhere when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` aren't both set.
- **All three methods converge on one account per email**: signing up with a password on an existing magic-link address attaches the password to that same account; Google sign-in on a known email links to it automatically (`allowDangerousEmailAccountLinking: true` — safe here because every account on this app only becomes usable after its email is independently proven one way or another).
- `passwordHash` was added directly to the existing native-driver `users` collection the MongoDB adapter owns (not a new Mongoose model — that collection's shape is the adapter's contract, not this app's to redefine).
- New pages: `/signup`, `/verify-account`, `/forgot-password`, `/reset-password`; `/signin` rewritten to stack Google → password login → magic link. No auto-login after verifying a signup or completing a reset — both land back on `/signin` with a success message.
- **Nav cleanup**: dropped the redundant "Builder" link (it only ever redirected to the dashboard) and moved developer-only "Docs"/"Playground" out of the header; signed-out nav now shows "Log in" and "Sign up" instead of one "Sign in" link.
- Homepage: added a placeholder "Start from a template" section (6 "coming soon" cards) between the code snippets and "How it works" — the real templates are Phase 7.

**A significant, non-obvious architectural side effect:** NextAuth requires JWT sessions the moment any Credentials provider is registered — it has no safe way to mint a database session row for a Credentials sign-in. Since the session strategy is global, not per-provider, this took *every* sign-in method off database sessions and onto JWT, including the pre-existing magic link. `auth.ts`'s `jwt`/`session` callbacks now thread the account id through `token.sub` instead of relying on the adapter looking up a session row. This was the riskiest change in the phase — the full 71-test 5a/5b/5c regression suite was re-run specifically to confirm nothing broke silently, and it didn't.

**Real bugs found only after deploying (not catchable by Playwright, since there's no way to drive a real Google consent screen from a test):**
- **`client_id=undefined` sent to Google** — Auth.js v5's built-in `Google` provider defaults to reading `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, not the `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` names used everywhere else in this app. Fixed by passing `clientId`/`clientSecret` explicitly.
- **`OAuthAccountNotLinked`** — Auth.js refuses by default to attach a new Google sign-in to an existing account with a matching email. Fixed with `allowDangerousEmailAccountLinking: true`, justified above.

**A real bug this phase's own tests caught before shipping:** `PasswordLoginForm` used uncontrolled `<input>`s inside a server-action form; React resets uncontrolled fields once the action finishes, so a failed login attempt silently blanked the *email* field too, not just the password. A user who fixed only the password on retry would submit an empty email and see the same generic error with no visible reason. Fixed by making both fields controlled state. (`SignInForm`'s identical, lower-severity issue on its one field was left alone — a pre-existing 5b file, out of scope here.)

**Tests:** 10 new e2e tests (`password-auth.spec.ts`) — full signup→verify→login, wrong password/unverified email, duplicate signup rejected, a magic-link account gaining a password, weak password/mismatched confirm, expired/reused links, forgot-password→reset→login with the old password dying immediately, forgot-password silence (same response whether the address is unknown, magic-link-only, or has a real password), Google button hidden when unconfigured, and an accessibility scan. Every test sets a unique `x-forwarded-for` header so the suite doesn't trip its own per-IP rate limit. **95 e2e tests total, all passing, alongside the full pre-existing 85-test regression** — confirming the JWT-session switch broke nothing.

**Not built yet:** account settings page (change email/remove password/disconnect Google — closed later, see the hardening backlog below); rate limiting on the Credentials `authorize()` call itself (only email-sending is rate-limited, not login attempts — closed later by the login-rate-limit item below); "remember this device"/session-length configuration; a SaaS-style homepage rewrite (only the templates placeholder was added, the page's dev-marketing identity is unchanged).

Deep reference: `PHASE_5B2_PASSWORD_AND_GOOGLE_AUTH.md`.

---

## Phase 5c — Verified-email respondents

**What was built:**
- A second **access mode** on `Form` (`anyone` | `verified_email`, default `anyone`). On a `verified_email` form, a respondent sees only the form's name and an email box until they prove they control that address.
- **Verification challenge** (`VerificationChallenge`): one emailed link, single-use, 15-minute expiry, only a SHA-256 hash of the token stored (never the usable token itself).
- **Respondent identity** (`RespondentIdentity`): "this email address has proven it controls itself," stored once per address, unique on `(type, normalizedValue)` — deliberately *not* a Formora account; the respondent never signs up for anything.
- **Respondent session**: a small signed cookie (`fr_<formId>`) proving "this browser verified this email for this one form," valid 2 hours. Verified with `timingSafeEqual`, checks the form id matches the one being accessed *now*, and fails closed (returns `null`) without revealing which check failed. One cookie per form — a cookie earned on form A is useless on form B even for the same address.
- **Two endpoints**: `POST /verify/request` (always `200`, reveals nothing about whether the address was seen before; 60s cooldown + 5/hour per address + 20/hour per IP) and `POST /verify/confirm` (one atomic `findOneAndUpdate` does the check-and-consume together, so a double-click or replay can only ever have one winner; `410` for both "expired" and "already used," so a client can't tell which).
- **The email link opens a page with a "Continue to form" button, not the action itself** — the same reasoning Auth.js already uses: mail clients and security scanners routinely GET every link in an email automatically, which would burn a GET-triggered one-time token before a human ever sees it. Only the button's `POST` actually consumes it.
- **Server-side enforcement on submit**: the public page's email gate is a UX convenience only; `POST /api/forms/[slug]/submit` independently checks the respondent cookie and returns `401` with `code: "verification_required"` if it's missing or invalid — a crafted request can't skip the gate by hitting the API directly.
- **Builder UI**: a dropdown ("Anyone with the link" / "Only people who verify their email") above the canvas; the dashboard tags a locked-down form with "(verified email)" next to its link. Republishing without specifying `accessMode` keeps the form's current mode rather than silently reopening it.
- Shared email plumbing (`lib/email.ts`) factored out of 5b's magic-link sender so both features send through the same console/Resend transport, with subject-line sanitization and `escapeHtml()` applied to the creator-chosen form name before it reaches an email a respondent reads.
- New `APP_ORIGIN` env var: verification links are never built from the incoming request's `Host` header (spoofable), only from `APP_ORIGIN`, then Vercel's own production URL, then (dev only) the request's own origin.

**A real infrastructure problem mid-phase, not a code bug:** the machine's C: drive filled up (turbo/npm caches), which took down Docker Desktop, and a later drive consolidation to reclaim space erased the D: drive's Docker data and separately the Git install. **Fix:** local development moved from a Docker `mongo:7` container to a separate Atlas database (`formora_dev`, same cluster as production, different database name) — kept isolated from production. Two Atlas passwords pasted into chat by mistake during the move were rotated immediately, same rule as the `AUTH_SECRET` incident in 5b: anything typed into a conversation is burned the moment it's typed.

**Tests:** 14 new e2e tests (`verified-email.spec.ts`) — the field list never reaches the browser pre-verification, server-side 401 without a cookie, the full email→link→continue→submit path with the stored submission's identity id verified to match, GET-vs-POST distinguishing a harmless preview fetch from a real consumption, expired/cross-form/malformed/forged/reused-cookie rejections, cooldown and per-address/per-IP caps, bad input (422/404 cases), mode-switching semantics, the builder dropdown round-tripping through a real publish, and an accessibility scan. **85 e2e tests total**, alongside all pre-existing tests and unit tests, all clean.

**Not built yet:** account linking (closed in 5d); a "Your responses" list for respondents (closed in 5d); phone verification (5e); a creator-facing view of people who started but never completed verification; the 60s/5-per-hour/20-per-hour limits are fixed constants, not configurable per form.

Deep reference: `PHASE_5C_VERIFIED_EMAIL.md`.

---

## Prioritized hardening and scalability backlog

A running set of production-readiness items tracked alongside the phases, not gated behind any one of them.

**Centralized, validated environment variables** — `lib/env.ts` parses every env var once through Zod (`MONGODB_URI`'s scheme, `AUTH_SECRET`'s length, `RESEND_API_KEY`/`EMAIL_FROM` required together with `EMAIL_TRANSPORT=resend`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` as a pair or not at all — closing off exactly the shape of the `client_id=undefined` bug from 5b-2 for good). Every direct `process.env.*` read across the app now goes through `getEnv()`/`isGoogleConfigured()`. Verified against a clean production build and the full e2e suite.

**Rate-limited password login** — a new `LoginAttempt` model: 5 failed attempts per email or 20 per IP within a 15-minute fixed window locks out further tries, checked *before* calling `signIn`. A nonexistent email is recorded and locked out identically to a real one, so the two stay indistinguishable by which eventually get blocked. Only failed attempts count. 4 new e2e tests.

**Security headers** — `next.config.ts` now sets a Content Security Policy plus `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS everywhere. `/f/[slug]` allows framing (`frame-ancestors *`, like a real Google Forms link); every other route denies it outright. `style-src`/`script-src` include `'unsafe-inline'` as a deliberate, documented tradeoff — a stricter policy broke Next's own inline hydration scripts outright (111 passing e2e tests dropped to 43 failing on the first attempt), and the fully-correct nonce-based fix would force every page into per-request dynamic rendering, undoing the existing static generation and conflicting with the caching item below. `script-src` still blocks loading a script from any other origin, which is the actual protection against an injected `<script src="evil.example">`. Verified against a real built-and-started production server with headers actually inspected, plus the full 111-test e2e suite.

**Caching published public forms** — `getPublishedFormBySlug` wraps its MongoDB read in `unstable_cache`, tagged `form:<slug>`, 60-second revalidate as a safety net. Publish/unpublish call `invalidatePublishedForm(slug)` immediately after changing a form rather than waiting out the 60 seconds. The cached shape is a plain JSON-safe object, not raw Mongoose documents (which carry `ObjectId`/`Date` fields that don't round-trip through the cache cleanly). Deliberately *not* used for anything needing live state (`published`/`closesAt`/`maxResponses` checks still query Mongo directly on every request) — verified by several existing e2e tests that republish a form and immediately re-check its public page, which would fail outright on stale cached data.

**Health endpoints** — `GET /api/health` (instant liveness, no dependencies) and `GET /api/ready` (a real MongoDB ping, 503 if unreachable), kept separate so a database outage actually shows as down rather than a liveness check staying green through it. Neither exposes configuration or stack traces.

**`maxResponses` builder UI** — a number field in the builder using the same set/keep/clear-via-publish pattern as `closesAt`. Rejects zero, negative, and non-integer values with `422`. Shown on the dashboard.

**`limitOneResponsePerRespondent` enforcement and UI** — a checkbox, enabled only when access mode is `verified_email` (disabled and explained otherwise, so the UI itself states the limitation instead of silently accepting a setting that can't work for anonymous forms). The publish route rejects `true` on an `anyone`-mode form with `422`, and force-clears the flag server-side if a form is switched back to `anyone` while it was still `true`. Enforced on submit by checking for an existing submission with the same `respondentIdentityId`, returning `409` pointing the respondent at editing their existing response instead.

**Account settings page** (`/account`) — change email (sent to and confirmed by the *new* address via the same `AccountVerificationToken` machinery as signup/reset, a new `change-email` purpose), remove a password, disconnect Google. No "do you have another sign-in method" lockout guard needed on remove/disconnect, since every account can always fall back to an emailed magic link regardless of password/Google state. 7 new e2e tests. The magic-link sign-in form's uncontrolled-field email-clearing bug (same class as the `PasswordLoginForm` bug in 5b-2) was fixed here too.

**Deliberately not built:** production error monitoring (Sentry or similar — tracked, not yet added); moving distributed rate limits off Mongo `countDocuments` queries onto Redis/Upstash — explicitly deferred, since at Formora's current traffic the Mongo-based checks are fast enough and adding that infrastructure now would be solving a problem that doesn't exist yet; a verified sending domain (SPF/DKIM) in Resend — owner task, optional for a demo.

---

## Phase 5d — Response dashboard, account linking, and response editing

**What was built:**
- **`allowResponseEditing` actually enforced.** The mechanics (a per-submission edit token, `POST /api/forms/[slug]/submission/update`) existed from earlier work but nothing ever gated them — every form allowed editing unconditionally. The flag now gates the update route for real, and a builder checkbox controls it. **A deliberate behaviour change, not a bug**: every pre-existing form now defaults to editing *off* (the schema always defaulted the flag to `false`; only enforcement was missing), matching the schema's original, more conservative intent — a creator relying on the old always-on behaviour has to explicitly turn the checkbox on and republish.
- **Response dashboard** (`/forms/[slug]/responses`): server-side cursor pagination (`{t: submittedAt, i: _id}`, base64-encoded — not page numbers, which silently break as new responses arrive between loads; `_id` as a tiebreaker in case two responses share a millisecond). Search is a case-insensitive substring match against a precomputed `Submission.searchText` field (a lowercased, space-joined copy of every answer), filtered by `formId` first so the scan never touches another form's data. A `from`/`to` date-range filter narrows by `submittedAt`. `totalCount` recomputes live on every request.
- **Detail view** (`/forms/[slug]/responses/[submissionId]`): shows a response's full answers labelled against the `FormVersion` it actually answered, not the form's current version — so labels stay correct even after the creator edits the form later.
- **CSV export**, streamed with a `ReadableStream` in fixed 500-row batches so memory stays flat regardless of response count. Makes two passes over the data on purpose: one to discover any answer keys that exist only on an older `FormVersion` (so they aren't silently dropped), one to actually write rows. Deliberately synchronous, not an async background job, and CSV-only (no `.xlsx`) — building real job infrastructure or a spreadsheet writer now would solve a problem this app doesn't actually have yet at its current scale; Vercel's function time limit is the accepted ceiling, revisited only if a real creator ever hits it.
- **Ownership check** (`getOwnedForm`) on every list/detail/export endpoint and page: a form owned by someone else 404s exactly like one that doesn't exist, extending the same anti-enumeration rule publish/unpublish already followed.
- **Database index** `{formId, submittedAt, _id}` (replacing the plan's originally-sketched `{formId, responseId}` once cursor pagination's real query shape was worked out), plus `{respondentIdentityId, submittedAt}`.
- **Account linking** (`lib/account-linking.ts`): a `RespondentIdentity.normalizedValue` matching a creator account's own email — and *only* that, never an email that happens to appear inside an ordinary form answer — links the two, in whichever order they occur. Called from three places since either order is possible: password-signup confirmation, Auth.js's `events.createUser` (magic link / Google), and the respondent-verification confirm route itself. `/my-responses` shows a signed-in creator every submission linked to their account by identity — form name and date only, deliberately never the answers (an e2e test asserts a submitted secret string never appears anywhere on the page, not just that the UI doesn't show it).

**A real cross-page-navigation bug caught while writing these tests:** early drafts signed in via a separate `playwright.request.newContext()` and then tried to navigate the actual browser `page` — the session cookie lived in the wrong context, so the page was never really signed in. Fixed by always signing in through `page.request` specifically, so the cookie lands where navigation happens.

**Tests:** 8 new e2e tests (`responses.spec.ts`) covering sort order, search, pagination correctness (two pages, no overlap, correct `totalCount`), detail-view labelling, CSV header/content, non-owner 404s across all three endpoints and both pages, and the dashboard link appearing for published forms. 5 new e2e tests (`account-linking.spec.ts`) for both link orderings, a sanity check that unrelated emails never link, and the answers-never-leak guarantee. **133 e2e tests total** (one transient failure under added parallel load on the first full run did not reproduce on rerun), 87 unit tests, all clean.

**Not built yet:** async/background export (deliberate deferral, see above); `.xlsx` output; re-verification tied specifically to editing a `verified_email` form's response (the edit-token mechanism is uniform across both access modes by design); date-range filter UI in `ResponsesList` (the API supports it, no date pickers wired up yet — later closed, see below); pagination inside the detail/export view for a single response with an unusually large number of fields.

Deep reference: `PHASE_5D_RESPONSE_DASHBOARD.md`.

---

## Phase 6 — Conditional logic and calculated fields

**What was built:**
- **`packages/core/src/logic-engine.ts`**: pure functions over a `FormDefinition` and an answers object, no React or server dependency — `evaluateCondition` (loosely-typed comparisons, since HTML form values arrive as a mix of types), `evaluateVisibility` (every field defaults visible; a field with rules is visible only if *all* its own rules pass), and a small deliberately-non-`eval` arithmetic formula language (`evaluateFormula`/`extractFormulaIdentifiers`) for calculated fields — `+ − × ÷`, parentheses, field ids as identifiers, chaining one calculated field off another, with a cycle guard so a circular dependency resolves to no value instead of looping. **Why not `eval`**: the formula is authored by the form's creator but executes in the respondent's browser — real arbitrary-code-execution risk, not just a correctness concern.
- **Validation is now visibility-aware everywhere**: `validateSubmission` (core), the client-side resolver, and `collectServerErrors` (server) all compute visibility first and skip every check for a currently-hidden field — it's never required, and a stale value left over from before it was hidden never blocks or pollutes a submission. Schema referential-integrity checks were extended to reject visibility/calculated-field rules that reference an unknown field id.
- **The renderer stays live**: `useFormRenderer` subscribes to the whole form via `useWatch`, so visibility and calculated values update as the respondent types, not just on submit; hidden columns (and any row left empty) are filtered out before `FormRenderer` ever sees them. A calculated field renders `disabled` with a "Calculated automatically" caption, and its value is recomputed from submitted answers on submit regardless of what the field ever displayed.
- **The server never trusts a submitted calculated value**: `applyCalculatedFields` runs before validation and before persisting on both the submit and update routes, silently overwriting anything the client posted — a forged `{ total: 999999 }` is replaced with the real recomputed number before it's checked or saved.
- **Builder Logic tab**: a Visibility section (toggle, default single condition, operator + value picker that adapts to the referenced field's type, an all/any selector once a second condition exists) and a Calculated section (shown only for `number` fields; formula is a plain text input, with clickable chips that insert another number field's id, so a creator never has to go hunting for a field's raw id). `removeField` now also strips the removed field out of every other rule's conditions/inputs, not just rules that directly targeted it, so deleting a referenced field never leaves behind a definition the schema would reject on republish.

**What this deliberately doesn't do:** no cross-type calculated fields (string concatenation, date math — arithmetic only, always targeting a `number` field); no UI restriction stopping a creator from picking a nonsensical operator/field-type combination (the engine just evaluates it to `false`); no multi-rule-per-field UI (the engine supports it, the builder never produces it); no cycle *detection with a warning* — a cyclic dependency just silently resolves to nothing.

**Tests:** 15 new core tests (every operator, visibility combinations, formula edge cases, calculated-field chaining/cycles), 4 new schema referential-integrity tests, 1 new validation test (hidden field's required check skipped and re-enforced), 5 new react renderer tests, 2 new builder store tests plus 3 new Logic-tab UI tests, and 5 new e2e tests (`conditional-logic.spec.ts`) covering the full public-form flow, server-side recomputation against a forged value, a hidden-and-missing field never being required, and the builder's Logic tab round-tripping through a real publish. **118 unit tests and 146 e2e tests, all passing.**

**Not built yet:** `@hardikrastogi/kyc` (scope reduced — see the note in `ROADMAP.md`: webcam liveness/face-match dropped, scoped down to document upload + OCR only, not yet started); the "Customer Feedback"/"Multi-step Survey"/"KYC Onboarding" template demos that would exercise this live (Phase 7).

Deep reference: `PHASE_6_CONDITIONAL_LOGIC.md`.

---

## UI polish pass — components, homepage, and nav (apps/web only)

A visual-identity pass on the hosted app, not tied to any feature phase. Went through two real reversals, kept here in full rather than summarized away.

**shadcn primitives**, added to `apps/web` only (never the publishable packages): `Sonner` for toast confirmations (account actions, builder publish/unpublish), a cva-based `Badge` component for dashboard/response status pills, and a `cmdk`-powered keyboard-navigable field palette in the builder (arrow keys + Enter, layered on top of the existing search/drag-and-drop). `cmdk` was added as a real dependency of `@hardikrastogi/builder` itself — a deliberate call, since that package is published to npm and this isn't a dev-only tool.

**Homepage redesign, twice.**
- *First pass*: stripped down to just a hero — wordmark, tagline, two CTAs — with a warm-neutral retheme, a static dot-grid background, a word-reveal title animation, and a conic-gradient hover glow on the primary CTA. All hand-built in CSS (`color-mix()`, `@property` for animating the gradient angle), no new dependency.
- *Second pass*, after the user pointed at Aceternity's Background Boxes component: replaced the static dot-grid with a full-bleed grid of individually-hoverable cells (plain CSS `:hover`, no JS/library), then — matching a reference screenshot the user provided — added a 3D perspective tilt (`transform: perspective() rotateX() scale()`) and a center-focused fade affecting *both* the grid pattern and the cursor-reactive hover (a radial-gradient `mask-image` on an outer wrapper). A first attempt at this fade was removed on the reasoning that dimming an interactive hover effect away from center felt wrong — then reinstated once the reference screenshot made clear that was exactly the intended look, confirmed against the actual reference rather than re-guessing a second time. Grid intensity and background tone were also lightened so the "Formora" heading stayed legible against the grid instead of visually competing with it.

**Dark "aurora" theme — shipped, then reverted.** Tried a full dark, violet-accented retheme across the whole app (inspired by Aceternity's Aurora Background), including an animated gradient hero. Reverted cleanly via `git revert` (not a rewrite) once the user judged the result unprofessional-looking — the warm-neutral light theme and Background Boxes hero above are what's actually live today. Two real bugs were caught and fixed before the revert, worth keeping in mind for any future dark-theme attempt:
- Native form controls (`<input>`/`<select>`) silently ignore custom CSS variables and keep their light OS appearance unless the page also sets `color-scheme: dark` explicitly.
- An animated `filter: blur(60px)` background repaints every frame and is expensive enough under 6-way parallel Playwright execution to intermittently starve unrelated tests (timeouts, one real "Target page, context or browser has been closed" crash in an unrelated password-rate-limit test). Fixed by moving the blur to a static `::before` layer and animating only `transform` on it — compositor-only, no repaint; confirmed by going from 6 e2e failures to 0, reproducibly.

**Header nav rebuilt as a pill nav**, matching React Bits' real `PillNav` component — its actual source was pulled from GitHub after a first hand-rolled attempt (a sliding cross-item indicator built from `getBoundingClientRect`/`useLayoutEffect`) turned out not to match the real component's behavior at all. The real version: each link shows a dark circle rising from the bottom on hover with the label flipping to an inverted colour, and the current page gets a small dot indicator rather than a filled pill — all pure CSS transitions, no GSAP, since the actual effect is a two-state hover, not a choreographed timeline. The "npm" link in the header was removed first (it had no real role once the site had proper docs/playground pages). Went through a few rounds of visual tweaks before landing: a `color-mix` hover background that was only 6% opacity (effectively invisible) fixed to a clearly visible state, then the track's outer border changed to white, then the whole black track/fill changed to match the page background rather than solid black.

**Mobile overflow fixes**, found from real phone screenshots, not guessed at: the pill nav wrapped its labels onto two lines on narrow viewports, and the builder's own toolbar (Save/Publish/Share) had no overflow handling at all and was silently clipped past the screen edge with no way to reach it. Both fixed the same way — `overflow-x: auto` + hidden scrollbar + `flex-shrink: 0` on the scrollable row, plus `min-width: 0` on the flex containers (a classic flexbox gotcha: without it, items refuse to shrink below their content size and the overflow rule does nothing). Confirmed by actually scrolling the toolbar in a screenshot and watching the clipped buttons reappear. **Not fixed**: the builder's three-panel layout (palette/canvas/inspector) still isn't usable at phone width — that needs a real responsive redesign (tabs, or collapsible panels), not an overflow tweak, and wasn't attempted here.

**Form accent border/heading underline made opt-in.** This Phase 5/6-era theming feature reused `theme.colors.primary` directly to draw a border around the whole form and an underline under its heading — and since `colors.primary` always has a default value, every published form showed both whether the creator asked for them or not. Reported as "thick blue borders" the user didn't recall choosing. Root-caused by reproducing it directly with Playwright and `getComputedStyle` (first suspected a per-field border rule that didn't exist — it was one continuous border around the whole `.df-form`, not per-field boxes). Fixed with a new `theme.accentBorder: boolean` (default `false`) that now gates both the border and the underline; a checkbox in the builder's Theme tab turns it on. Also closed a real pre-existing test-coverage gap — the original feature had shipped with no dedicated tests of its own at all; added schema tests (core), renderer tests (react, confirming no border even with a primary colour set unless the flag is on), a builder toggle test, and 3 new e2e tests checking actual computed CSS on published forms.

**Tests:** schema/unit/e2e coverage for `accentBorder` as described above; all pre-existing suites re-run clean after the aurora revert and the pill-nav rewrite.

**Not done:** a dedicated design-system or component-library writeup; no dark-mode decision for the product going forward, just a documented lesson from one reverted attempt.

Logged in detail in `ROADMAP.md`'s "UI polish pass" section.

---

## UI polish pass, continued — JellyNav, dark mode, and mobile round two

Picks up right after the entry above: the pill nav got replaced again (this time with a real ported component, not an approximation), a full dark mode shipped, a real hero bug got fixed, the homepage got filled back out, and a second round of phone screenshots surfaced three more mobile issues.

**JellyNav replaces the pill nav.** The hand-rolled pill nav just above was always a CSS *approximation* of React Bits' `PillNav`. This time the user pasted React Bits' actual `JellyRadio` source directly — a radiogroup component built for picking one of N mutually-exclusive options, not navigation. Rather than paste it verbatim (which would have meant rendering nav links as `role="radio"` elements — a real accessibility regression, screen readers would announce "radio button," not "link," and clicking wouldn't be real navigation), it was adapted: real `<Link>`s for actual routing/back-forward/screen-reader correctness, with the jelly swell/push spring physics playing on hover/focus instead of a committed radio selection, and the current route getting a persistent filled chip instead of a radio "checked" dot. This needed the `motion` package as a new dependency — unlike the pill nav, the per-neighbor stagger and spring bounce genuinely need real physics, not just CSS transitions. Wrapper class named `Formora_DF`, the exact name given when asked to name it.

**The hero heading's black-on-black collision, actually fixed.** The box-grid's hover highlight is the same black as the heading text, so wherever it swept under a word the letters visually vanished into it. Fixed with `mix-blend-mode: difference` — scoped to the heading only, not the tagline/description paragraphs, since those are a lighter muted gray and the blend math (`|white − backdrop|`) can't reproduce that tone without visibly darkening them at rest; asked to "keep the text intact," so only the one element that was already plain black got the treatment. Two real bugs surfaced before this worked:
- The blend initially did *nothing* — the heading just rendered solid white everywhere, hover or not. Root cause: the text wrapper (`relative z-10`) and the box grid (`z-index: 0`) were each creating their own separate CSS stacking context as siblings, and `mix-blend-mode` only blends against content painted in the *same* stacking context. The heading was blending against an empty local backdrop, not the grid behind it. Fixed by dropping both `z-index`s — neither was actually needed, since DOM order alone already painted the text after (on top of) the grid.
- Once blending worked, the inverted text came out pale gray instead of crisp white. The hover fill used `var(--foreground)` (a dark charcoal, not true black), and `difference` needs an exact black/white backdrop to invert cleanly — anything lighter leaves a gray result. Fixed with a dedicated `--hero-box-hover` token pinned to exact black (and later, white in dark mode — see below).

**Dark mode shipped.** The earlier "aurora" attempt (see the entry above) was reverted for looking unprofessional, but it turned out the shadcn scaffold had left a complete `.dark` CSS variable block sitting unused in `globals.css` the whole time — a warm-charcoal palette in the same hue family as the light theme, needing zero retheming work. What was actually missing was the switching mechanism:
- A `theme-provider` context (`useTheme()`) that's the hard default to light — it never reads `prefers-color-scheme`; only an explicit `localStorage` choice ever turns dark mode on — plus a tiny inline `<script>` in `<head>` that applies the `.dark` class before React hydrates, so there's no flash of the wrong theme on load.
- The toggle itself is a ported React Bits `SquishSwitch` (drag-to-toggle spring physics kept exactly as pasted), extended with `iconOff`/`iconOn` slots — not present in the original component — so a sun/moon icon crossfades inside the thumb as it toggles, using `lucide-react` (already a dependency, no new one added). A real bug caught before it ever rendered: both icons were going to be colored against the thumb's own background token, which meant the moon icon would've been invisible against its own identical backdrop — fixed by giving both icons the same contrasting color instead, since the thumb's background token doesn't actually change between the two states.
- A broad 220ms `background-color`/`color`/`border-color`/`fill`/`stroke` transition on `*` (guarded under `prefers-reduced-motion`) smooths the whole-page recolor into a cross-fade instead of an instant snap, without touching anything that needs to feel instant (the box-grid's hover fill keeps its own `transition-duration: 0s`; the switch thumb's drag position is driven by `motion` inline styles, untouched by CSS transitions).
- Two theme-coverage gaps were found only by actually toggling the switch and looking, not by reading the CSS: `--home-background` (the homepage's own background token, kept separate from `--background` since the hero/header/footer/template-cards all read it specifically) had no `.dark` override at all — so toggling dark mode flipped every button and text color but left the whole homepage visibly stuck on its light pink tone. And the box-grid's hover fill needed to flip from black to white in dark mode for the mix-blend trick above to still invert correctly — handled by making `--hero-box-hover` itself a themed token.

**Homepage filled back out.** Re-added a "Built for real work" use-cases section and a "Coming next" upcoming-templates grid — both had been lost somewhere across the hero rewrites — and fixed the hero's background tone (`--home-background`, a custom pink-tinted token) not matching the header/footer's plain `--background`, which made the site's own chrome visibly two-toned against its biggest section. Scoped with `body:has(.home-page) .site-header, .site-footer { background: var(--home-background) }` so the override only ever applies on the homepage itself, not every other page using the header/footer.

**Mobile, round two.** A fresh set of real phone screenshots (homepage and the builder) surfaced three more issues the first mobile pass (see above) hadn't covered:
- The header's four-item signed-in nav (My forms / Your responses / Account / Sign out) still didn't fit once the dark-mode toggle was added next to it. Fixed with a hamburger-opened sidebar holding the first three links, leaving only "Sign out" directly on the bar on narrow screens — desktop keeps the full pill group unchanged. A real bug here too: the sidebar's overlay initially rendered squeezed into the header's own small box instead of covering the screen. Cause: the header has `backdrop-blur` (a `backdrop-filter`), and any `filter`/`backdrop-filter` on an ancestor makes *that* element the positioning root for a `position: fixed` descendant instead of the viewport — a real, easy-to-miss CSS gotcha. Fixed by portaling the overlay straight to `document.body` via `createPortal`, escaping the header's containing block entirely.
- The box-grid's cursor-reactive hover fill doesn't make sense on touch devices — a tap simulates `:hover` with no pointer able to "leave" afterward, so boxes were getting stuck lit after scrolling/tapping around the hero. Fixed by scoping the hover rule to `@media (hover: hover) and (pointer: fine)`; the static grid line pattern itself is untouched on mobile, only the interactive fill is gated.
- The builder's three-panel `15rem/1fr/18rem` fixed grid had no responsive breakpoint at all, and was genuinely unreadable on a phone — palette and inspector squeezed together and overlapping, canvas compressed to nothing. This closes the "not fixed" gap called out in the previous mobile-overflow entry above. Fixed with a breakpoint at 48rem that stacks the three panels vertically instead — Canvas first (what you're actually looking at), then Palette, then Inspector — each independently scrollable rather than a full tabbed interface, which was judged a reasonable, much smaller fix for the same "unusable" complaint.

**Tests:** verified against a full `pnpm turbo run build` (all packages + the Next.js production build, TypeScript checked) before each push, plus live Playwright screenshots at a real iPhone-width (390×844) viewport with touch emulation for the nav overflow fix, the box-hover-disable fix, and the builder's stacked mobile layout. No new automated test suite entries were added this round — this was all manual verification via screenshots during the session, not new Vitest/Playwright spec files.

**Not done:** a dedicated design-system or component-library writeup; the builder's mobile layout is stacked and readable now but not a polished tabbed interface; mobile verification covered the homepage and the builder's empty state specifically — the dashboard, responses list, account page, docs pages, and the builder with a field actually selected haven't been separately checked at phone width.
