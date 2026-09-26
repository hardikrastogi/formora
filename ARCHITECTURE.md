# Formora — Architecture & Data Flow

How data moves through the system: UI → frontend logic → backend → storage. Updated as each phase adds a new piece — this describes the app as it actually exists, not the target design (that's [ROADMAP.md](./ROADMAP.md)).

---

## `@hardikrastogi/core` Internal Shape (implemented in Phase 1)

```
FormDefinition (Zod schema)
   ├── fields[]        — FieldConfig (id, type, label, required, defaultProps, validation rules)
   ├── layout          — { rows: [{ id, columns: [{ span, fieldId }] }] }  (12-column grid)
   ├── theme           — { colors, radius, font, density }
   └── logic           — { visibility: VisibilityRule[], calculated: CalculatedField[] }

FormSubmission (Zod schema)
   └── { formId, schemaVersion, answers, meta }

validateSubmission(definition, answers)
   → checks each field's required/min/max/pattern rules against answers
   → returns { success, errors: Record<fieldId, string[]> }

FieldPluginRegistry
   → register({ type, schema, defaultProps, Editor, Renderer, validate })
   → future field types (text, KYC, etc.) plug in here; core has no React dependency
```

This is pure logic — no network calls, no database, no rendering. Every later phase (renderer, builder, backend) is a consumer of these schemas and this validation function, not a reimplementation of them.

---

## `@hardikrastogi/react` Rendering Flow (implemented in Phase 2)

```
FormDefinition JSON (from anywhere: file, API, builder state)
   │
   ▼  FormDefinitionSchema.safeParse        → invalid? show readable error, stop
   │     (applies defaults, checks ids/layout/logic references)
   ▼  buildRows                              → layout rows → columns → { field, plugin }
   │     (fields missing from the layout are appended as full-width rows)
   ▼  <FormRenderer>  (one <form class="df-form">, theme → CSS variables)
   │     for each column:  registry.get(field.type).Renderer
   │        unknown type → "Unsupported field type" placeholder
   ▼  user types → react-hook-form holds the answers
   ▼  submit → resolver runs:
   │     1. core validateSubmission (required / min / max / pattern)
   │     2. the field type's own validate (e.g. email format)
   │     errors → shown per field, first invalid field focused, onSubmit NOT called
   ▼  valid → cleanAnswers → onSubmit({ fieldId: value })
```

The renderer never talks to a server or database. What happens to the answers after `onSubmit` is the host app's job (in the hosted product: the submission API route, which must validate again on the server).

---

## High-Level Package Relationship

```
@hardikrastogi/core        (Zod schemas, validation engine — no UI, no framework)
        ↑ depended on by
@hardikrastogi/react        (headless renderer, field components)
        ↑ depended on by
@hardikrastogi/builder      (drag-drop authoring UI)
        ↑ used by
apps/web                    (Next.js: docs, playground, hosted forms, auth)
```

`@hardikrastogi/templates` and `@hardikrastogi/kyc` plug into this as field-type/data providers, not a separate layer.

---

## Form-Building Flow (Builder) — implemented in Phase 4, backend part still Phase 5

```
User clicks or drags a field from the Palette (dnd-kit)
   → builder store's addField() → Immer-produced update to the in-memory FormDefinition
   → a snapshot of the PREVIOUS definition is pushed onto the undo stack
   → Canvas re-renders (registry lookup per field, same plugins @hardikrastogi/react uses)
   → useAutosave debounces ~500ms, then writes the definition to localStorage (Phase 4 stand-in)
   → [Phase 5, not yet built] debounced PATCH to a real backend instead of localStorage
   → [Phase 5, not yet built] server validates against @hardikrastogi/core's Zod schema, persists via Mongoose

Preview toggle → the SAME FormDefinition is handed straight to <FormRenderer>, unmodified —
                 there is no separate "preview data", so what you see is what respondents would get.
```

The store lives entirely in the browser tab; nothing here talks to a network yet.

---

## Publishing Flow — implemented in Phase 5a

```
Creator clicks Publish in the builder
   → apps/web's publishForm() → POST /api/forms/publish { definition }
   → server validates with core's FormDefinitionSchema
   → Form.findOneAndUpdate({ slug }, ..., { upsert: true })   (slug defaults to definition.id)
   → FormVersion.create({ formId, definition, schemaVersion })   ← an IMMUTABLE snapshot, never edited again
   → Form.currentVersionId = new version; Form.published = true
   → builder shows "Live at /f/slug" + enables Share

Editing the form afterward touches ONLY the in-memory FormDefinition (still autosaved to
localStorage, Phase 4-style) — it can't retroactively change a version a respondent already
saw. Only clicking Publish again creates the NEXT version.
```

## Form-Filling Flow (Respondent) — implemented in Phase 5a

```
Respondent opens /f/[slug]
   → getPublishedFormBySlug(slug): Form.findOne({ slug }) → must be published
        → FormVersion.findById(currentVersionId)
        → FormDefinitionSchema.safeParse(version.definition)   (fail closed on corruption)
        → null at any step → Next.js notFound() → real 404, not a broken page
   → generateMetadata() adds OG title/description from the definition's name
   → @hardikrastogi/react's <FormRenderer> renders it client-side (packages/f/[slug]/public-form.tsx)
   → Respondent fills form → client-side validation (core + field-type checks, same as always)
   → Submit → POST /api/forms/[slug]/submit { answers, idempotencyKey }
        → re-fetch the form; reject if unpublished (410), closed, or over maxResponses
        → collectServerErrors() from @hardikrastogi/react/server — re-runs core's rules
          AND the email/url format checks server-side (client validation is not trusted)
        → Submission.create(); a repeated idempotencyKey returns the ORIGINAL submission
          instead of erroring or duplicating
   → "Your submission has been recorded." only shown after the server call succeeds
```

`@hardikrastogi/react/server` is a second, separate build of the package with no `"use client"`
banner — the main entry is entirely client-tagged (required for `<FormRenderer>`), and Next.js
blocks importing anything at all from a `"use client"` module in server code, even pure functions.

---

## Auth Flow

Creators sign in with an emailed magic link (Auth.js v5, MongoDB adapter, database sessions). There are no passwords.

```
/signin  --(email)-->  server action requestLink
   -> Auth.js creates a one-time token in MongoDB and calls sendMagicLink(to, url)
        EMAIL_TRANSPORT=console : print the link + store it in dev_email_outbox (local/e2e only)
        EMAIL_TRANSPORT=resend  : POST https://api.resend.com/emails
   -> user opens the link -> /api/auth/callback/email consumes the token (single use, 15 min)
   -> session cookie (authjs.session-token) -> redirect to the safe `next` path
```

- **Where identity is checked:** route handlers and server pages call `getUserId()` (`lib/auth/session.ts`). There is no middleware, so pages stay simple and the docs remain static. The header reads the session in the browser (`AuthNav`) for the same reason.
- **Ownership:** `Form.ownerAccountId` is set by the first signed-in publisher. Publish returns 403 for a different owner; unpublish matches on owner and answers 404 otherwise, so slugs cannot be probed. `Draft` documents are keyed by (owner, form id) and only ever returned to their owner.
- **Drafts vs published:** the builder autosaves the working copy to `Draft` (lenient, since a half-edited form must still save). Publishing validates the full schema and snapshots a `FormVersion`, as in 5a.
- **Open redirects:** `safeRedirectPath` only accepts same-site paths for the post-sign-in `next` parameter.
- **Respondents are not accounts.** Verified-email respondents (5c) use a separate token system.

---

<!-- Update each section above as its phase is actually implemented. Add new sections (e.g. KYC verification flow) as those phases land. -->

---

## `apps/web` (implemented in Phase 3)

```
Visitor's browser
   │
   ▼  Next.js App Router (all pages are static, prerendered at build time)
   │     /            landing
   │     /docs/*      9 documentation pages (server components)
   │     /playground  one client component
   │     /builder     one client component wrapping @hardikrastogi/builder's <Builder>
   │
   ▼  /playground data flow (everything happens in the browser, nothing is sent anywhere)
        JSON text (textarea)
           → JSON.parse  ── invalid? show the error, keep the last valid definition
           → <FormRenderer definition registry>   (registry = 8 built-ins + custom "rating")
                 → FormDefinitionSchema.safeParse → invalid? the renderer explains why
                 → fields drawn on the 12-column grid
           → user submits → answers → wrapped as a FormSubmission { formId, schemaVersion, answers, meta }
           → shown on screen as JSON (this is what a real backend would receive)
```

There is still no backend, database or account system. The hosted-form flow (publish, respondent access modes, submissions API, MongoDB) arrives in Phase 5.
