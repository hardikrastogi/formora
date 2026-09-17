# Formora

A schema-driven, dynamic form builder shipped as a set of versioned npm packages, with a Next.js showcase app on top.

Drag fields onto a customizable grid, style them through design tokens, add conditional logic, and share forms via a link — with a pluggable identity-verification (eKYC) field pack as its core differentiator.

## Status

🚧 Early development — monorepo scaffolding in progress.

## Packages

| Package | Description |
|---|---|
| `core` | Zod schema types, validation engine, `FormDefinition`/`FormSubmission` shapes, versioning |
| `react` | Headless renderer (hooks + unstyled primitives), base field types |
| `builder` | Drag-drop authoring UI (dnd-kit, 12-column grid, inspector panel) |
| `kyc` | Verification field pack (liveness, doc capture, face match, OCR) |
| `templates` | Starter `FormDefinition` JSON set |
| `cli` | (stretch) npx scaffolding tool |

## Apps

| App | Description |
|---|---|
| `web` | Next.js docs, playground, public form pages, submission API routes |

## License

MIT — see [LICENSE](./LICENSE).
