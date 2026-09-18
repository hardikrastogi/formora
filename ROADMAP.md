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

- [ ] Package scaffold (same tsup/package.json pattern as `core`)
- [ ] `react` as peerDependency, depends on `@hardikrastogi/core`
- [ ] Renderer hook (e.g. `useFormRenderer(definition)`) wired to `react-hook-form`
- [ ] 8 base field types: text, email, number, select, date, checkbox, radio, textarea
  - [ ] Each field: unstyled Radix-based component + `.df-*` class names
- [ ] Theme tokens applied as CSS custom properties on a `.df-form` wrapper
- [ ] `classNames` prop for per-slot overrides
- [ ] Prebuilt `styles.css` consumers import once
- [ ] Basic Playwright test: render a form, fill it, submit, check output shape
- [ ] Publish `@hardikrastogi/react@0.1.0`

**Milestone:** a plain React app (not Next.js) can `npm install` both packages, pass in a hand-written `FormDefinition`, and render a real, fillable, validated form.

---

## Phase 3 — Next.js Docs + Playground (Weeks 8–9)

First real, linkable, public artifact.

- [ ] `apps/web` Next.js App Router setup (Tailwind + shadcn/ui here only)
- [ ] Docs pages: install instructions, quickstart, per-package API docs
- [ ] Playground page: live editable `FormDefinition` JSON → live rendered form
- [ ] Deploy to Vercel
- [ ] Add badges/links to root `README.md`

**Milestone:** a public URL exists that you can put on a CV/portfolio today.

---

## Phase 4 — `@hardikrastogi/builder`: Drag-Drop Authoring UI (Weeks 10–14)

The actual "form builder" experience.

- [ ] Package scaffold, depends on `core` + `react`
- [ ] Zustand + Immer store holding the live `FormDefinition` (edits mutate it directly)
- [ ] Immer patches wired to undo/redo
- [ ] Three-panel layout: palette (left) / canvas (center) / inspector (right)
- [ ] dnd-kit: drag fields from palette onto the 12-column grid canvas
- [ ] Inspector tabs: Basic / Validation / Logic / Style (progressive disclosure — Validation/Logic collapsed by default)
- [ ] Preview mode toggle (same view, not a separate route)
- [ ] Top bar: form name, Preview toggle, Share, save-state indicator
- [ ] WCAG AA contrast check on primary theme color, inline warning if it fails
- [ ] Publish `@hardikrastogi/builder@0.1.0`

**Milestone:** you can open the builder in `apps/web`, drag fields onto a grid, style it, and see a live preview — the core "wow" demo.

---

## Phase 5 — Hosted Forms (Weeks 15–17)

- [ ] Auth: Auth.js (NextAuth v5) with Google OAuth, using its MongoDB adapter (decided — not in original tech stack table)
- [ ] MongoDB Atlas (M0 free tier) connected via Mongoose — app-layer only
- [ ] `/f/[slug]` public form page in `apps/web`
- [ ] Submission API route: validate against `core`'s Zod schema, then persist via Mongoose
- [ ] OG meta tags on `/f/[slug]` for link-preview sharing
- [ ] Save-state indicator wired to real autosave (debounced PATCH as the builder edits)

**Milestone:** you can build a form, get a share link, have someone else fill it out, and see the submission land in MongoDB.

---

## Phase 6 — Conditional Logic + `@hardikrastogi/kyc` (Weeks 18–22)

- [ ] `visibleIf` conditional field visibility, wired into both renderer and builder Logic tab
- [ ] Calculated fields (derived values from other answers)
- [ ] `@hardikrastogi/kyc` package scaffold
  - [ ] `VerificationProvider` interface + mock provider
  - [ ] Client-side liveness detection (webcam + randomized gesture prompt)
  - [ ] Document capture with blur/glare detection
  - [ ] Face match via face-api.js
  - [ ] OCR via Tesseract.js
  - [ ] Files uploaded to S3/R2 via presigned URLs — submission stores reference + hash only, never raw media
  - [ ] README section documenting this as a deliberate DPDP Act–aware design decision

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
