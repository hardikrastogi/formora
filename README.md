# Formora

[![npm core](https://img.shields.io/npm/v/%40hardikrastogi%2Fcore?label=%40hardikrastogi%2Fcore)](https://www.npmjs.com/package/@hardikrastogi/core)
[![npm react](https://img.shields.io/npm/v/%40hardikrastogi%2Freact?label=%40hardikrastogi%2Freact)](https://www.npmjs.com/package/@hardikrastogi/react)
[![Live site](https://img.shields.io/badge/live-formora--web.vercel.app-black)](https://formora-web.vercel.app)

A schema-driven, dynamic form builder shipped as a set of versioned npm packages, with a Next.js showcase app on top.

**Live:** [formora-web.vercel.app](https://formora-web.vercel.app) · [Docs](https://formora-web.vercel.app/docs) · [Playground](https://formora-web.vercel.app/playground)

Describe a form as one JSON document and render a working, validated, themeable form from it in any React app. Planned next: a drag-and-drop builder, hosted shareable forms, and a pluggable document-verification field pack.

## Status

Early, versioned 0.x. `core`, `react`, and the visual `builder` all work today, and a first slice of hosting is live: publish a form, get a shareable `/f/[slug]` link, anonymous respondents can fill it out. Creator accounts, verified-email/phone respondents, and a response dashboard are still planned (see [ROADMAP.md](./ROADMAP.md)).

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
