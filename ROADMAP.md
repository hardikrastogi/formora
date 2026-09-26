# Formora — Build Roadmap

Paced for ~1–2 hours/day. Each phase ends with something working/demoable before the next one starts. Check items off as you go.

---

## Phase 0 — Repo & Publish Pipeline Setup ✅ DONE

- [x] Decide package scope → `@hardikrastogi`
- [x] npm account + login (`npm whoami` confirmed)
- [x] Git initialized, `.gitignore` / `LICENSE` / `README.md` written
- [x] pnpm installed, `pnpm-workspace.yaml` + root `package.json` + `turbo.json`
- [x] Folder skeleton: `packages/{core,react,builder,kyc,templates,cli}`, `apps/web`
- [x] `@hardikrastogi/core` scaffolded (package.json, tsup config, tsconfig)
- [x] First build via tsup succeeded (ESM + CJS + `.d.ts`)
- [x] First publish succeeded: `@hardikrastogi/core@0.0.1` is live on npm

- [x] First git commit (local only — GitHub push deferred by choice)
- [x] `pnpm changeset init` — set up version/changelog workflow

**Phase 0 complete.**

---

## Phase 1 — `@hardikrastogi/core`: Schema & Validation Engine (Weeks 2–4) ✅ DONE

The foundation everything else depends on. No UI yet — pure TypeScript + Zod.

- [x] Define `FormDefinition` Zod schema
  - [x] `fields` — array of field configs (id, type, label, validation rules, defaultProps)
  - [x] `layout` — 12-column grid (`rows: [{ columns: [{ span, fieldId }] }]`)
  - [x] `theme` — token object (`colors`, `radius`, `font`, `density`)
  - [x] `logic` — conditional visibility rules (`visibleIf`), calculated fields
  - [x] top-level metadata: `id`, `name`, `version`/`schemaVersion`, `createdAt`, `updatedAt`
- [x] Define `FormSubmission` Zod schema
  - [x] `{ formId, schemaVersion, answers, meta }`
- [x] Field-type plugin interface: `{ type, schema, defaultProps, Editor, Renderer, validate }`
- [x] Validation engine: given a `FormDefinition` + answers, return pass/fail + field-level errors
- [x] Schema versioning logic (so old submissions still validate/render against their original schema version)
- [x] Vitest unit tests for schema validation (valid/invalid cases per field type)
- [x] Bump + publish `@hardikrastogi/core@0.1.0` once schemas are stable

**Milestone:** you can construct a `FormDefinition` object by hand, validate a fake submission against it, and see real pass/fail output — all in a test file, no UI required yet.

---

## Phase 2 — `@hardikrastogi/react`: Headless Renderer (Weeks 5–7)

Turns a `FormDefinition` into an actual rendered, fillable form.

- [x] Package scaffold (same tsup/package.json pattern as `core`)
- [x] `react` as peerDependency, depends on `@hardikrastogi/core`
- [x] Renderer hook (`useFormRenderer(definition)`) wired to `react-hook-form`, plus `<FormRenderer />`
- [x] 8 base field types: text, email, number, select, date, checkbox, radio, textarea
  - [x] Each field: unstyled component + `.df-*` class names (Radix for checkbox/radio/label; native `<select>`)
- [x] Theme tokens applied as CSS custom properties on a `.df-form` wrapper
- [x] Per-field `style` overrides (added to core `FieldConfig`)
- [x] `classNames` prop for per-slot overrides
- [x] Prebuilt `styles.css` consumers import once
- [x] Component tests: render, fill, submit, validation errors, theming (Vitest + Testing Library, 12 tests)
- [ ] Real-browser end-to-end test (Playwright) — deferred to Phase 3, needs the playground page as a host
- [ ] Publish `@hardikrastogi/core@0.2.0` then `@hardikrastogi/react@0.1.0`

**Milestone:** a plain React app (not Next.js) can `npm install` both packages, pass in a hand-written `FormDefinition`, and render a real, fillable, validated form.

> **Later addition (after Phase 4):** 5 more built-in field types — `url`, `time`, `rating`, `country`, `currency` — bringing the total to 13. See the dated `BUILD_LOG.md` entry.

---

## Phase 3 — Next.js Docs + Playground (Weeks 8–9)

First real, linkable, public artifact.

- [x] `apps/web` Next.js App Router setup (Tailwind + shadcn/ui here only)
- [x] Docs pages: introduction, installation, quickstart, FormDefinition reference, field types, theming, custom field types, API reference
- [x] Playground page: live editable `FormDefinition` JSON → live rendered form, 3 examples, submission output
- [x] Real-browser end-to-end tests (Playwright) plus automated accessibility scans (axe) — 37 tests
- [x] Publish `@hardikrastogi/core@0.2.0` and `@hardikrastogi/react@0.1.0` to npm
- [x] Deploy to Vercel — live at [formora-web.vercel.app](https://formora-web.vercel.app)
- [x] Add badges/links to root `README.md`

**Phase 3 complete.**

**Milestone:** a public URL exists that you can put on a CV/portfolio today.

---

## Phase 4 — `@hardikrastogi/builder`: Drag-Drop Authoring UI (Weeks 10–14) ✅ DONE

The actual "form builder" experience.

- [x] Package scaffold, depends on `core` + `react`
- [x] Zustand + Immer store holding the live `FormDefinition` (edits mutate it directly)
- [x] Undo/redo (whole-definition snapshots, not Immer patches — see note below)
- [x] Three-panel layout: palette (left) / canvas (center) / inspector (right)
- [x] dnd-kit: drag fields from palette onto the canvas, or click to add; drag existing fields to reorder
- [x] Inspector tabs: Basic / Validation / Logic / Style (Logic is a placeholder until Phase 6)
- [x] Preview mode toggle (same view, not a separate route) — renders the real `FormRenderer`
- [x] Top bar: form name, Undo/Redo, Theme button, Preview toggle, Share (disabled, stubbed for Phase 5), save-state indicator
- [x] WCAG AA contrast check on primary theme color, inline warning if it fails
- [x] Wired into `apps/web` at `/builder`, with a matching `/docs/builder` reference page
- [x] Autosave to localStorage as a stand-in for the Phase 5 backend autosave
- [x] Publish `@hardikrastogi/builder@0.1.0`

> **Simplification:** undo/redo stores whole `FormDefinition` snapshots rather than Immer's inverse patches — form definitions are small, so this is simpler and equally correct, at the cost of slightly more memory for very long undo histories (capped at 50 steps).
>
> **Scope note:** fields are one per row for now; a field's width (1–12 grid columns) is set numerically in the Style tab rather than by dragging fields side by side into the same row.

**Milestone:** you can open the builder, drag fields onto a grid, style them, and see a live, working preview — the core "wow" demo. ✅

---

## Phase 5 — Hosted Forms, Sharing & Response Management (Weeks 15–27)

This phase turns Formora into a Google Forms alternative. It's the largest phase in the roadmap, so it's split into five independently-shippable sub-phases (5a–5e) instead of one block — each ends with something real you can click through, per the "no phase should depend on a later, unbuilt one" rule.

**Two structural decisions that apply across all of 5a–5e:**
- **Draft vs. published split.** The builder autosaves a live, mutable `FormDefinition`. But a published form must render identically forever, even after the creator keeps editing. So publishing creates an immutable snapshot (a `FormVersion`) — editing after publish doesn't touch already-collected responses; it prepares the *next* version. Without this, `schemaVersion` alone doesn't protect old responses from a creator's later edits.
- **Hosting metadata stays out of the portable schema.** `slug`, `published`, `accessMode`, `allowResponseEditing` — these live in the app's own Mongo `Form` document, never inside `FormDefinition` itself. Otherwise every template or exported JSON would carry hosting config, breaking the "packages work standalone" promise from decisions 4 and 11.

---

### Phase 5a — Publish, share, and the simplest respondent flow (`anyone` mode) ✅ DONE

The smallest possible slice that's a genuinely working hosted form.

- [x] MongoDB connected via Mongoose — app-layer only, `.env`-based connection string (local Docker for now; Atlas is a drop-in swap of `MONGODB_URI` later, per the earlier secrets decision)
- [x] `Form` document: `slug`, `published`, `currentVersionId`, `ownerAccountId` (nullable until 5b), `allowResponseEditing`/`limitOneResponsePerRespondent`/`closesAt`/`maxResponses` — separate from `FormDefinition`
- [x] `FormVersion` document: an immutable snapshot of a `FormDefinition` at publish time
- [x] Publish/Republish button + live share-link display in the builder's top bar; a Share button that uses the Web Share API or falls back to copying the link
- [x] Public page at `/f/[slug]` rendering the published `FormVersion` via `FormRenderer` — no Formora account required
- [x] Submission API route: validate the answers against `core`'s Zod schema **and** each field type's format check (email/url) again on the server, then persist via Mongoose
- [x] `FormSubmission` records which `FormVersion` (not just which `schemaVersion` number) it answered
- [x] Success state after submit: "Your submission has been recorded," only shown after the server confirms it was saved
- [x] Idempotency key per submission attempt (unique index on `formId + idempotencyKey`) so retries/double-clicks can't create duplicates
- [x] OG meta tags on `/f/[slug]` for WhatsApp/email/social link previews
- [x] Unpublishing (410 on new submissions) and a never-published/unknown slug (404) both handled distinctly
- [x] `Form` schema has `limitOneResponsePerRespondent`, `closesAt`, `maxResponses` fields (max-responses cap enforced in the submit route; the other two are stored but not yet enforced — no builder UI exposes them yet either)

**Milestone met:** build a form, publish it, share the link, have someone (anonymously) fill it out, see it land in MongoDB. Verified for real — not just built — against a running MongoDB, including idempotent retries, republishing, and unpublish/404 handling. 17 new automated tests (unit + e2e).

### Phase 5b — Creator accounts

- [ ] Auth.js (NextAuth v5): email magic link + optional "Continue with Google," using the MongoDB adapter (no passwords — avoids storing/resetting them, per the earlier decision)
- [ ] Requires a real domain with SPF/DKIM set up for reliable magic-link delivery
- [ ] Forms are owned by an `Account`; only the owner can edit/publish/view responses for their forms
- [ ] Save-state indicator wired to real autosave (debounced PATCH as the builder edits, replacing the builder's current localStorage stand-in)

**Milestone:** you have to sign in to build/manage forms; the builder's autosave now hits a real backend instead of localStorage.

### Phase 5c — Verified-email respondents

- [ ] Add `verified_email` as a second access mode (`anyone` stays the default)
- [ ] Respondent enters an email → receives a magic link → clicks "Continue to form" → returns to the *same* form
- [ ] Short-lived, single-use verification tokens: expiry, resend cooldown, max attempts, IP/identity rate limits
- [ ] A stable `RespondentIdentity` reference stored per verified submission — without ever creating a Formora account for the respondent
- [ ] Reuses the same email-delivery provider from 5b

**Milestone:** a creator can require email verification before someone can fill out a sensitive form.

### Phase 5d — Response dashboard, account linking, and editing

- [ ] Creator dashboard per form: total response count, recent activity, server-side cursor-paginated list (never loads all responses at once)
- [ ] Search, filters, sorting, and a response-details view with complete answers
- [ ] Async CSV/Excel export for large response sets
- [ ] Database indexes: `formId + submittedAt`, `formId + responseId`, `respondentIdentityId + submittedAt`
- [ ] Authorization check on every list/detail/export endpoint — ownership only
- [ ] Account linking: creating an account with the same verified email links prior anonymous-to-Formora-but-verified submissions; a "Your responses" section shows only form name + date
- [ ] Per-form `allowResponseEditing` toggle; when on, a re-verified respondent can open and update their own response (never someone else's)
- [ ] `submittedAt`, `updatedAt`, `revisionNumber` recorded on every edit

**Milestone:** creators can safely browse/export large response sets, and returning respondents can find and edit their own past answers.

### Phase 5e — Verified-phone respondents (last, and optional)

- [ ] `verified_phone` access mode: phone + country code → SMS OTP → verify → continue
- [ ] Phone number normalization to E.164 before storing/matching
- [ ] **Before building:** confirm current SMS provider pricing and India DLT (sender/template registration) requirements — these change and directly affect feasibility/cost
- [ ] Same token/rate-limit rules as 5c, adapted for SMS

**Milestone:** phone verification works as a second respondent-verification option, matching the email flow's guarantees.

---

## Phase 6 — Conditional Logic + `@hardikrastogi/kyc` (Weeks 23–27)

- [ ] `visibleIf` conditional field visibility, wired into both renderer and builder Logic tab
- [ ] Calculated fields (derived values from other answers)
- [ ] `@hardikrastogi/kyc` package scaffold (scope reduced — see note below)
  - [ ] `VerificationProvider` interface + mock provider
  - [ ] Document image upload field type, with blur/glare detection
  - [ ] OCR via Tesseract.js
  - [ ] Files uploaded to S3/R2 via presigned URLs — submission stores reference + hash only, never raw media
  - [ ] README section documenting this as a deliberate DPDP Act–aware design decision

  > **Scope decision:** Webcam-based liveness detection and face-match (face-api.js) are dropped for now. Different industries use different vendors for video-based identity verification, so building a generic one doesn't fit a plugin-based, industry-agnostic product — that responsibility stays with `VerificationProvider` adapters a real vendor would supply. `kyc` here is scoped to document upload + OCR only.

**Milestone:** the "Customer Feedback" and "Multi-step Survey" templates work end-to-end with conditional logic; "KYC Onboarding" template demonstrates the mock verification flow live.

---

## Phase 7 — `@hardikrastogi/templates` (fold in alongside Phase 4–6)

- [ ] `@hardikrastogi/templates` package: `{ id, name, category, description, thumbnail, definition }[]`
- [ ] 6 starter templates: Contact Form, Event Registration, Job Application, Customer Feedback, KYC Onboarding, Multi-step Survey
- [ ] CI check: validate every template against the current Zod schema
- [ ] "Start blank" = template with zero fields (same code path as any other template)
- [ ] Deep-clone + fresh field IDs on template apply

---

## Phase 8 — Stretch Goals (after core is stable)

- [ ] `@hardikrastogi/cli`: `npx` scaffolding tool (commander/cac + @clack/prompts + fs-extra)
- [ ] AI-assisted form generation: NL prompt → LLM call constrained to the Zod schema → validated `FormDefinition`

---

## Ongoing, Not Phase-Gated

- [ ] Conventional Commits from the first real commit onward (`feat(core): ...`, `fix(react): ...`)
- [ ] Changesets on every meaningful change (`pnpm changeset`)
- [ ] GitHub Actions: lint/typecheck/test on PR (once pushed to GitHub)
- [ ] Track metrics as they become real: bundle size (bundlephobia), test coverage %, Lighthouse score
- [ ] `ARCHITECTURE.md` — why Zod, why Mongo over Postgres, why schema-first (write incrementally as decisions are made, not all at once at the end)
