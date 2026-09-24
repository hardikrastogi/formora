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

## Phase 5 — Hosted Forms, Sharing & Response Management (Weeks 15–22)

This phase turns Formora into a Google Forms alternative: creators publish forms, share a link through WhatsApp/email/any app, and respondents can complete the form without first creating a Formora account.

### Creator accounts and publishing

- [ ] Auth.js (NextAuth v5) with standard sign-up/sign-in plus optional Google OAuth, using its MongoDB adapter
- [ ] MongoDB Atlas connected via Mongoose — app-layer only
- [ ] Save-state indicator wired to real autosave (debounced PATCH as the builder edits)
- [ ] Publish/unpublish controls and a stable, unique `/f/[slug]` shareable URL
- [ ] Share action that copies the URL and opens the device share sheet when supported
- [ ] OG meta tags on `/f/[slug]` for useful WhatsApp, email, and social link previews
- [ ] Preserve the published `schemaVersion` so each response remains tied to the exact form version that was submitted

### Public respondent experience

- [ ] Render the exact published form at `/f/[slug]` without requiring a Formora account
- [ ] Let the creator choose one access mode per form:
  - [ ] `anyone` — no identity verification required
  - [ ] `verified_email` — respondent verifies an email magic link before continuing
  - [ ] `verified_phone` — respondent verifies a phone OTP before continuing
- [ ] Return verified respondents to the same form and preserve the intended form URL/state
- [ ] Use short-lived, single-use verification tokens with expiry, resend cooldowns, attempt limits, and abuse rate limits
- [ ] Submission API route: validate against `core`'s Zod schema, then persist through Mongoose
- [ ] Show a success dialog after submission: “Your submission has been recorded.”
- [ ] Store a stable respondent identity reference for verified submissions without forcing the respondent to create an account

### Account continuity and respondent history

- [ ] When a person later creates an account and verifies the same email/phone, safely link their earlier verified respondent identity to the new account
- [ ] Add a “Your responses” dashboard section showing only the form name and submission date for linked historical submissions
- [ ] Never link historical submissions using an unverified email/phone typed into an ordinary answer field
- [ ] Let respondents open a previous response and edit it only when the form creator has enabled response editing
- [ ] Record `submittedAt`, `updatedAt`, and response revision/audit information when an answer is edited

### Creator response dashboard

- [ ] Add a response dashboard for every owned form with total response count and recent activity
- [ ] Display responses using server-side pagination/cursor pagination rather than loading all responses at once
- [ ] Add search, filters, sorting, and an openable response-details drawer/page with complete submitted answers
- [ ] Add a per-form `allowResponseEditing` setting controlled by the creator
- [ ] Enforce ownership and authorization on every response-list and response-detail API route
- [ ] Add database indexes for form ID, respondent identity, submission date, and pagination order
- [ ] Support large forms (hundreds of thousands of responses) through paginated queries and asynchronous CSV/Excel exports

**Milestone:** a creator can publish and share a form; respondents can submit without creating an account using the creator-selected access mode; later accounts can discover their verified submission history; and creators can safely browse large response sets from their dashboard.

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
