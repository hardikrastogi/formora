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

## Form-Building Flow (Builder)

*(To be filled in once Phase 4's builder UI exists. Placeholder shape:)*

```
User drags field (dnd-kit)
   → Zustand store updates FormDefinition (Immer patch recorded for undo/redo)
   → Canvas re-renders via @hardikrastogi/react using the updated FormDefinition
   → Autosave debounces and PATCHes the definition to the backend
   → Backend validates against @hardikrastogi/core's Zod schema
   → Persisted via Mongoose to MongoDB
```

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
