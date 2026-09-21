# Formora

A schema-driven, dynamic form builder shipped as a set of versioned npm packages, with a Next.js showcase app on top.

Describe a form as one JSON document and render a working, validated, themeable form from it in any React app. Planned next: a drag-and-drop builder, hosted shareable forms, and a pluggable document-verification field pack.

## Status

Early, versioned 0.x. `core` and `react` work today; the docs site and playground live in `apps/web`. The visual builder and hosted forms are planned (see [ROADMAP.md](./ROADMAP.md)).

## Development

```
pnpm install
pnpm dev          # packages in watch mode + the docs site on http://localhost:3000
pnpm build        # build everything
pnpm test         # unit and component tests
pnpm test:e2e     # real-browser tests (Playwright, first run: pnpm --filter @hardikrastogi/web exec playwright install chromium)
```

## Packages

| Package | Description |
|---|---|
| `core` | Zod schema types, validation engine, `FormDefinition`/`FormSubmission` shapes, versioning |
| `react` | Headless renderer (hooks + unstyled primitives), base field types |
| `builder` | Drag-drop authoring UI (dnd-kit, 12-column grid, inspector panel) |
| `kyc` | (planned) Document upload + OCR field pack and a verification-provider adapter interface |
| `templates` | Starter `FormDefinition` JSON set |
| `cli` | (stretch) npx scaffolding tool |

## Apps

| App | Description |
|---|---|
| `web` | Next.js docs, playground, public form pages, submission API routes |

## License

MIT — see [LICENSE](./LICENSE).
