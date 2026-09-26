# Phase 5 — Hosted Forms: Deep Reference

A standalone, exhaustive technical reference for Phase 5a (the only Phase 5 sub-phase built so far). Kept separate from `ROADMAP.md` (the plan) and `BUILD_LOG.md` (the running summary) — this file goes line-by-line through what exists, function by function, so you can read it without needing to re-derive anything from the source.

Covers 5a only: **publish, share, and anonymous (`anyone`-mode) submissions.** Creator accounts, verified respondents, and the response dashboard are 5b–5e, not yet built.

---

## 1. The big picture

Before Phase 5, Formora had no backend at all — `core` validates, `react` renders, `builder` edits, all in the browser. Phase 5a adds the first server: a Next.js app with API routes talking to MongoDB.

**One sentence per new concept:**
- **`Form`** — a database row holding hosting settings (slug, published or not, which version is live). Never contains the actual form JSON.
- **`FormVersion`** — an unchangeable snapshot of a `FormDefinition`, created every time you click Publish. Old versions are never edited, only replaced by a new one.
- **`Submission`** — one respondent's answers, linked to the exact `FormVersion` they answered.

Why split `Form` and `FormVersion` instead of one document? Because the builder autosaves constantly while you edit — if publishing just pointed at that live, ever-changing document, editing the form *after* publishing could silently change what a submission from yesterday means. A snapshot fixes that: editing after publish only affects the *next* version.

---

## 2. Local environment setup (what actually runs where)

| Piece | What it is | Where |
|---|---|---|
| MongoDB | `mongo:7` Docker image | `docker run -d --name formora-mongo -p 127.0.0.1:27017:27017 -v formora-mongo-data:/data/db mongo:7` |
| Connection string | `mongodb://127.0.0.1:27017/formora_dev` | `apps/web/.env.local` (gitignored — real value, never committed) |
| Documented shape | placeholder only | `apps/web/.env.example` (committed — no secrets) |
| Restart after reboot | container persists, just needs restarting | `docker start formora-mongo` |
| Browse the data | MongoDB Compass, or `docker exec -it formora-mongo mongosh formora_dev` | — |

Production (Vercel) does **not** have this local database — it needs its own `MONGODB_URI` (Atlas) set as a Vercel environment variable before hosted forms work on the live site. This has not been done yet as of Phase 5a.

---

## 3. The three Mongoose models, field by field

All three live in `apps/web/src/lib/db/models/`.

### `Form.ts`

```ts
{
  slug: { type: String, required: true, unique: true, index: true },
  ownerAccountId: { type: String, default: null },
  published: { type: Boolean, default: false },
  currentVersionId: { type: Schema.Types.ObjectId, ref: "FormVersion", default: null },
  allowResponseEditing: { type: Boolean, default: false },
  limitOneResponsePerRespondent: { type: Boolean, default: false },
  closesAt: { type: Date, default: null },
  maxResponses: { type: Number, default: null },
}
```

| Field | Meaning | Enforced yet? |
|---|---|---|
| `slug` | The URL segment (`/f/<slug>`). Unique across all forms. | Yes — unique index, checked on every publish |
| `ownerAccountId` | Which creator account owns this form. | **No** — always `null` until Phase 5b adds accounts. Anyone can currently republish any slug. |
| `published` | Whether `/f/<slug>` and the submit route accept traffic. | Yes |
| `currentVersionId` | Points at the `FormVersion` currently live. | Yes |
| `allowResponseEditing` | Whether a respondent can edit their own past answer. | **No** — field exists, no code reads it yet (Phase 5d) |
| `limitOneResponsePerRespondent` | Cap one submission per identity. | **No** — field exists, unused (needs Phase 5c's identities to mean anything) |
| `closesAt` | A date after which submissions are rejected. | **Yes** — checked in the submit route |
| `maxResponses` | A hard cap on submission count. | **Yes** — checked in the submit route |
| `{ timestamps: true }` | Adds `createdAt`/`updatedAt` automatically. | Mongoose built-in |

### `FormVersion.ts`

```ts
{
  formId: { type: Schema.Types.ObjectId, ref: "Form", required: true, index: true },
  schemaVersion: { type: Number, required: true },
  definition: { type: Schema.Types.Mixed, required: true },
  publishedAt: { type: Date, default: Date.now },
}
```

`definition` is `Schema.Types.Mixed` — Mongoose stores it as an arbitrary nested object, with no schema enforcement at the database level. **The real validation happens in application code** (`FormDefinitionSchema.safeParse`, from `@hardikrastogi/core`) every time it's read back, not at write time. This is deliberate: the Zod schema is the single source of truth, not a second copy of it as a Mongoose schema.

### `Submission.ts`

```ts
{
  formId: { type: Schema.Types.ObjectId, ref: "Form", required: true, index: true },
  formVersionId: { type: Schema.Types.ObjectId, ref: "FormVersion", required: true },
  schemaVersion: { type: Number, required: true },
  answers: { type: Schema.Types.Mixed, required: true },
  idempotencyKey: { type: String, required: true },
  respondentIdentityId: { type: String, default: null },
  revisionNumber: { type: Number, default: 1 },
  submittedAt: { type: Date, default: Date.now },
}
```

Two indexes matter here:
```ts
SubmissionSchema.index({ formId: 1, idempotencyKey: 1 }, { unique: true }); // prevents duplicate submissions
SubmissionSchema.index({ formId: 1, submittedAt: -1 });                     // fast "recent responses" queries later
```

The first one is what makes retries safe — see §5.

**Every model uses this exact pattern to avoid Mongoose's "OverwriteModelError":**
```ts
export const FormModel = mongoose.models.Form ?? mongoose.model("Form", FormSchema);
```
Next.js's dev server hot-reloads modules, which would otherwise try to redefine the same Mongoose model twice and crash. `mongoose.models.Form` checks "does this model already exist on this connection?" before creating it.

---

## 4. The connection singleton (`apps/web/src/lib/db/connect.ts`)

```ts
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set...");
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(MONGODB_URI);
  cache.conn = await cache.promise;
  return cache.conn;
}
```

Why cache on `globalThis` instead of a module-level variable? Because Next.js's dev server can reload this file's module on every code change, which would reset a normal module-level variable and open a fresh connection every time you save a file. `globalThis` survives module reloads (it doesn't survive a full process restart, which is fine — a fresh connection there is correct).

The `cache.promise ??= mongoose.connect(...)` line matters: if two requests call `connectToDatabase()` at nearly the same time before either has finished connecting, both get the *same* in-flight promise instead of opening two connections.

Every API route and `getPublishedFormBySlug` calls this first, always `await`ed.

---

## 5. `POST /api/forms/publish` — line by line

File: `apps/web/src/app/api/forms/publish/route.ts`

```
1. Parse the request body as JSON. Malformed JSON → 400.
2. Read { definition, slug } from the body.
3. FormDefinitionSchema.safeParse(definition) — reject with the exact Zod issues (422) if invalid.
4. Compute the slug:
     - if the caller supplied one, slugify() it
     - otherwise, slugify() the definition's own `id`
   slugify() lowercases, replaces every run of non-alphanumeric characters with a single "-",
   trims leading/trailing "-", and caps length at 63 characters.
5. isValidSlug() checks the result matches ^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$ (or a single char).
   Reject (422) if the slug came out empty/invalid.
6. connectToDatabase()
7. Upsert the Form by slug:
     FormModel.findOneAndUpdate({ slug }, { $setOnInsert: { slug } }, { new: true, upsert: true })
   → if the slug already exists, this just returns the existing Form (republish case).
   → if it doesn't, this creates a brand-new Form with just the slug set.
8. Create a NEW FormVersion, now that form._id definitely exists:
     FormVersionModel.create({ formId: form._id, schemaVersion, definition })
9. Point the Form at this new version and mark it published:
     form.published = true; form.currentVersionId = version._id; await form.save();
10. Respond 200 with { slug, url: "/f/<slug>" }.
```

**Why step 7 and step 8 are in that order (this was a real bug):** the very first working version of this route tried to create the `FormVersion` *before* the `Form` existed, passing `formId: null` — but `FormVersion.formId` is `required: true`, so Mongoose rejected it with `Path 'formId' is required'`. The fix was simply to create the `Form` first, then the `FormVersion` with a real `formId`, then link them.

**The slug-collision limitation, stated plainly:** since the slug defaults to the definition's own `id`, and there's no ownership check yet, two *different, unrelated* forms that happen to produce the same slug would silently overwrite each other's published version. This is acceptable for a single-demo-form Phase 5a, and is explicitly called out as needing a real fix once Phase 5b/5d add multi-form management with actual ownership.

---

## 6. `getPublishedFormBySlug` — the shared read path

File: `apps/web/src/lib/db/forms.ts`. Used by both the public page and (conceptually) anything else that needs "give me the live version of this form."

```ts
export async function getPublishedFormBySlug(slug: string): Promise<PublishedForm | null> {
  await connectToDatabase();
  const form = await FormModel.findOne({ slug }).lean();
  if (!form || !form.published || !form.currentVersionId) return null;

  const version = await FormVersionModel.findById(form.currentVersionId).lean();
  if (!version) return null;

  const parsed = FormDefinitionSchema.safeParse(version.definition);
  if (!parsed.success) return null; // corrupted snapshot — fail closed

  return { formId: String(form._id), form, version, definition: parsed.data };
}
```

Three completely different failure reasons — slug doesn't exist, form exists but isn't published, or the stored JSON somehow fails Zod validation — all collapse into the same `null` return. The caller (the `/f/[slug]` page) treats `null` uniformly as "show a 404," which is the right behavior for a respondent (they don't need to know *why* the form isn't there). `.lean()` is used throughout for read-only queries — it skips building full Mongoose document instances (with their change-tracking machinery), returning plain JS objects, which is faster when you're never going to call `.save()` on the result.

---

## 7. `POST /api/forms/[slug]/submit` — every branch explained

File: `apps/web/src/app/api/forms/[slug]/submit/route.ts`. This is the most defensive piece of code in Phase 5a — it assumes the client is lying about everything.

```
1. Parse the slug from the dynamic route param (Next.js 15+ makes `params` a Promise — must await it).
2. Parse the request body as JSON. Malformed → 400.
3. Validate the body's SHAPE (not content yet):
     - idempotencyKey must be a non-empty string, else 400
     - answers must be a plain object (not array, not null), else 400
4. connectToDatabase()
5. Look up the Form by slug.
     - not found at all → 404
     - found but not published, or has no currentVersionId → 410 ("no longer accepting responses")
     - found and published, but closesAt is in the past → 410 ("this form is closed")
6. Look up the FormVersion by form.currentVersionId.
     - not found (shouldn't happen if the Form's data is consistent, but checked anyway) → 410
7. Re-parse the stored definition with FormDefinitionSchema.safeParse.
     - fails → 500 ("this form's definition is corrupted") — this would mean bad data got into
       the database somehow; treated as a server problem, not a client one
8. If form.maxResponses is set, count existing submissions for this form.
     - at or over the cap → 410 ("reached its response limit")
9. Run collectServerErrors(definition, answers) — see §8 for what this actually checks.
     - any errors → 422 with { errors: { fieldId: [messages] } }
10. Try to create the Submission.
     - succeeds → 201 with { submissionId }
     - fails with a MongoDB duplicate-key error (code 11000, meaning idempotencyKey already
       used for this formId) → look up the EXISTING submission with that key, return its id
       with 201 (same success response, not an error) — this is what makes retries safe
     - fails for any OTHER reason → the error is re-thrown (Next.js turns it into a 500)
```

**Status code cheat sheet for this route:**
| Code | Meaning here |
|---|---|
| 200 | never returned by this route |
| 201 | submission created (or an idempotent retry of one that already exists) |
| 400 | the request itself is malformed (bad JSON, missing idempotencyKey, answers isn't an object) |
| 404 | no form exists with this slug at all |
| 410 | the form exists but isn't currently accepting submissions (unpublished, closed, or full) |
| 422 | the form exists and is open, but the *answers* fail validation |
| 500 | the server's own stored data is corrupted, or an unexpected database error |

---

## 8. `collectServerErrors` and the `@hardikrastogi/react/server` split — the trickiest part of Phase 5a

### The problem

The first working version of the submit route called `validateSubmission` from `@hardikrastogi/core` — but that function only checks the *generic* rules every field has (`required`, `minLength`, `maxLength`, `min`, `max`, `pattern`). It has no idea that an `email` field's value should look like an email address, or that a `url` field's value should start with `http(s)://` — those specific checks live inside the **`email` and `url` field plugins** in `@hardikrastogi/react`, as each plugin's own `validate` function, used client-side by `FormRenderer`.

Result: a tampered request could POST `{"email": "not-an-email"}` straight to the submit route (bypassing the browser entirely, e.g. with `curl`) and it would sail through, because the server literally didn't know the email-format rule existed.

### The next problem this caused

The obvious fix — import `collectErrors` (which already combines core's rules *and* each plugin's `validate`) and `createDefaultRegistry` from `@hardikrastogi/react` in the submit route — failed to even build:

```
Error: Attempted to call createDefaultRegistry() from the server but
createDefaultRegistry is on the client.
```

Why: `@hardikrastogi/react`'s entire built bundle (`dist/index.js`) starts with a `"use client";` directive, added by `tsup.config.ts`'s `banner` option, because `<FormRenderer>` needs it to work when a Next.js Server Component imports it. But that banner tags the **whole file**, not just the component. Next.js's bundler refuses to let server code import *anything* from a module marked `"use client"` — even a plain function that never touches React, because it can't tell the difference between "this specific export is safe" and "this file is client-only" from the directive alone.

### The fix: a second, separate build output

`packages/react/tsup.config.ts` was changed from a single build config to an **array of two configs**:

```ts
export default defineConfig([
  { entry: ["src/index.ts"], banner: { js: '"use client";' }, /* ...the existing client build... */ },
  { entry: { server: "src/server-validation.ts" }, /* no banner at all */ },
]);
```

This produces `dist/server.js` / `dist/server.cjs` with **no `"use client"` directive**, sitting alongside the existing `dist/index.js`. `package.json`'s `exports` map gained a new subpath:

```json
"./server": {
  "types": "./dist/server.d.ts",
  "import": "./dist/server.js",
  "require": "./dist/server.cjs"
}
```

So `import { collectServerErrors } from "@hardikrastogi/react/server"` resolves to a genuinely separate, server-safe file — Next.js has no reason to block it, because that file was never tagged client-only in the first place.

### `src/server-validation.ts` itself

```ts
const TYPE_CHECKS: Record<string, (value: unknown) => string | null> = {
  email: (value) => (typeof value === "string" && EMAIL_PATTERN.test(value) ? null : "Enter a valid email address"),
  url: (value) => (typeof value === "string" && URL_PATTERN.test(value) ? null : "Enter a valid URL, starting with http:// or https://"),
};

export function collectServerErrors(definition, answers) {
  const errors = { ...validateSubmission(definition, answers).errors };  // core's generic rules first
  for (const field of definition.fields) {
    if (errors[field.id]) continue;                 // already failed a generic rule — don't pile on
    const value = answers[field.id];
    if (isBlank(value)) continue;                    // an optional, empty field has nothing to format-check
    const check = TYPE_CHECKS[field.type];
    if (!check) continue;                             // no format check for this type (or it's a custom type)
    const message = check(value);
    if (message) errors[field.id] = [message];
  }
  return errors;
}
```

`EMAIL_PATTERN` and `URL_PATTERN` are **not duplicated** — they were extracted into `packages/react/src/fields/patterns.ts` (a plain `.ts` file with zero React import), and both the client's `text-like.tsx` (the actual `email`/`url` field components) and this server file import the *same* constants. Only the small "loop over fields and check" orchestration logic differs between client and server — the actual regex, the single source of truth, lives in one place.

**Known limitation, stated plainly:** `collectServerErrors` only knows about `email` and `url` because those are the only two built-in types with a custom `validate` function today. A custom field type registered only in the browser (like the playground's `slider` demo) can't be re-validated server-side — there's no way for the server to know what a browser-only plugin's rules are.

---

## 9. The public page (`/f/[slug]`)

Two files, `page.tsx` (server) and `public-form.tsx` (client) — split because Next.js Server Components can't hold interactive state or event handlers, so the actual `<FormRenderer>` with its `onSubmit` has to live in a client component.

### `page.tsx`

- `generateMetadata()` runs on the server, calls `getPublishedFormBySlug(slug)`, and returns real Open Graph tags (`og:title`, `og:description`, plus a Twitter card) using the form's actual name — this is what makes a WhatsApp/Slack/email link preview show something meaningful instead of a generic site name. If the form doesn't exist/isn't published, the title just becomes `"Form not found"`.
- The page component itself does the same lookup again (Next.js doesn't automatically share data between `generateMetadata` and the page — each is its own render pass, though React's request-level caching often dedupes the actual database call) and calls Next.js's `notFound()` if `null`, which renders the framework's real 404 page with an actual `404` HTTP status — not a fake "not found" message on a `200` page.
- Params are `Promise<{ slug: string }>` and must be `await`ed — this is a Next.js 15+ requirement (dynamic route params became async).

### `public-form.tsx`

```tsx
const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
```
Generated **once** per page load, stored in a ref (not state — it never needs to trigger a re-render) and reused on every submit attempt from that page load, including retries. This is the client half of the idempotency mechanism described in §8's status-code table: if the network hiccups and the browser silently retries the POST, or the respondent double-clicks Submit before the button visually disables, the server sees the exact same key both times and returns the original submission instead of creating a second one.

If the fetch to `/submit` doesn't return `ok`, it reads the error body and `throw`s — which `FormRenderer` catches and displays under the form, per its existing error-handling contract. If it succeeds, `setSubmitted(true)` swaps the whole form out for the confirmation message.

---

## 10. The builder's publish/share UI

### The architectural rule this follows

`@hardikrastogi/builder` must never know that Next.js, `fetch`, or `/api/forms/publish` exist — it's a framework-agnostic package. So publishing is implemented as a **callback prop**, exactly like `FormRenderer`'s `onSubmit`: the package calls a function the host app provides, and only reacts to whether that function resolved or rejected.

### `BuilderProps.onPublish`

```ts
onPublish?: (definition: FormDefinition) => Promise<PublishResult>;
// where PublishResult = { url: string }
```

If this prop is omitted entirely, the Publish button doesn't render at all (see `TopBar`'s `{onPublish ? <button>...</button> : null}`) — this is what keeps the builder usable in contexts with nothing to publish to.

### State owned by `BuilderInner` (not the Zustand store — this is UI-only, ephemeral state)

```ts
const [publishState, setPublishState] = useState<"idle" | "publishing" | "error">("idle");
const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
const [publishError, setPublishError] = useState<string | null>(null);
```

### `handlePublish`

```
setPublishState("publishing")  → button shows "Publishing…" and disables
await onPublish(definition)     → host app's actual fetch() call happens here
  success → setPublishedUrl(result.url); setPublishState("idle")
             → button now says "Republish"; the "Live at ..." line appears; Share enables
  failure → setPublishState("error"); setPublishError(<message>)
             → an alert-role paragraph shows the error; the form itself is untouched
```

### `handleShare` and the origin bug it had

```ts
function resolveShareUrl(): string {
  if (typeof window === "undefined") return publishedUrl!;
  try {
    return new URL(publishedUrl!, window.location.origin).toString();
  } catch {
    return publishedUrl!;  // fallback
  }
}
```

The very first version of this didn't have the `try/catch` — it called `new URL(...)` directly and just returned the result. This throws in any context where `window.location.origin` isn't a valid absolute URL to use as a base (confirmed concretely: jsdom's default `about:blank` document has `origin === "null"`, the literal string, which `new URL()` rejects as an invalid base). Since `handleShare` is only invoked from an `onClick`, React never sees that thrown error — it would have failed completely silently, with the user clicking Share and simply nothing happening. The fix wraps the URL construction in its own function with a fallback to the raw (possibly relative) URL, and wraps the *entire* `handleShare` body in `try/catch` too, routing any failure into the same `publishError` state the publish flow already uses, so a real failure is at least visible instead of silent.

The actual sharing logic, once it has a safe URL:
```ts
if (navigator.share) {
  try { await navigator.share({ title: definition.name, url: shareUrl }); return; }
  catch { /* user cancelled the OS share sheet — not an error, fall through */ }
}
if (navigator.clipboard) { await navigator.clipboard.writeText(shareUrl); }
```
Mobile/supporting browsers get the native OS share sheet; everything else falls back to a plain clipboard copy.

---

## 11. Testing — what's covered, file by file

| File | What it tests | Count |
|---|---|---|
| `packages/react/src/__tests__/server-validation.test.ts` | `collectServerErrors` directly: core rules, email/url format catches, blank-field skipping, no double-reporting, unknown custom types ignored | 7 |
| `packages/builder/src/__tests__/builder.test.tsx` (additions) | Publish button absent without `onPublish`; pending → success state transition; error state on rejection; Share via clipboard; the origin-throws regression specifically | 5 new (one is a direct regression test for the bug in §10) |
| `apps/web/e2e/hosted-forms.spec.ts` | Full real-MongoDB integration: publish + OG tags, required-field 422, malformed-email 422, successful 201, idempotent retry (same key → same id), distinct keys → distinct submissions, unpublish → 410 + unknown/unpublished slug → 404, republish with a new required field, and one full builder-UI test (click Publish, follow the real link) | 9 |

**Isolation trick worth knowing:** every API-level test in `hosted-forms.spec.ts` generates its own random slug (`e2e-<name>-<timestamp>-<random>`) rather than using the builder's fixed `"builder-demo"` slug. Playwright runs tests across multiple parallel workers, and they all share the *same* MongoDB instance (unlike `localStorage`, which is isolated per browser context automatically) — without unique slugs, parallel tests would corrupt each other's data.

Run just this phase's tests:
```
pnpm --filter @hardikrastogi/react test          # includes server-validation.test.ts
pnpm --filter @hardikrastogi/builder test         # includes the publish/share tests
pnpm test:e2e                                     # includes hosted-forms.spec.ts (needs MongoDB running)
```

---

## 12. Manual verification commands (what was actually run to prove this works)

```bash
# Idempotent retry — same submissionId both times
curl -X POST http://localhost:PORT/api/forms/<slug>/submit -H "content-type: application/json" \
  -d '{"answers":{...},"idempotencyKey":"fixed-key"}'
# (run twice with the same key, compare the submissionId in both responses)

# Server-side format validation
curl -X POST http://localhost:PORT/api/forms/<slug>/submit -H "content-type: application/json" \
  -d '{"answers":{"email_1":"not-an-email"},"idempotencyKey":"x"}'
# → {"errors":{"email_1":["Enter a valid email address"]}}

# OG tags actually present in the HTML
curl http://localhost:PORT/f/<slug> | grep -o '<meta[^>]*property="og:[^>]*>'

# Unpublish then confirm submissions are rejected
curl -X POST http://localhost:PORT/api/forms/<slug>/unpublish
curl -o /dev/null -w "%{http_code}\n" -X POST http://localhost:PORT/api/forms/<slug>/submit -d '...'
# → 410

# Inspect the actual documents created
docker exec formora-mongo mongosh formora_dev --eval 'db.forms.find().toArray()'
docker exec formora-mongo mongosh formora_dev --eval 'db.submissions.find().toArray()'
```

---

## 13. Everything Phase 5a deliberately does NOT do yet

Stated explicitly so nothing here is mistaken for a bug:

- **No ownership/authorization.** Anyone who knows or guesses a slug can currently republish it. Fixed in 5b once accounts + `ownerAccountId` are actually checked.
- **No respondent identity.** `respondentIdentityId` exists on `Submission` but is always `null` — meaningless until 5c adds verified-email respondents.
- **`allowResponseEditing` and `limitOneResponsePerRespondent` are stored but inert** — no code path reads or enforces them yet.
- **No builder UI for `closesAt` / `maxResponses`** — they can only be set by hand-editing the database right now, even though the submit route already enforces them.
- **No rate limiting** beyond `maxResponses`/`closesAt` — no IP-based abuse protection yet.
- **Custom field types can't be re-validated server-side** — only the 13 built-in types are covered by `collectServerErrors`.
- **Slug collisions between unrelated forms are possible** — see §5.
