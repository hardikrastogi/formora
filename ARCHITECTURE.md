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

## Form-Filling Flow (Respondent)

*(To be filled in once Phase 5's hosted forms exist. Placeholder shape:)*

```
Respondent opens /f/[slug]
   → Next.js server fetches FormDefinition + schemaVersion from MongoDB
   → @hardikrastogi/react renders it client-side, wired to react-hook-form
   → Respondent fills form → client-side validation via core's Zod schema
   → Submit → POST to API route → re-validated server-side → FormSubmission persisted
```

---

## Auth Flow

*(To be filled in once Phase 5's auth lands — Auth.js/NextAuth v5 + Google OAuth + MongoDB adapter, per project decision.)*

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
