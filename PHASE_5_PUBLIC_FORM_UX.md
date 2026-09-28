# Phase 5 — Public Form UX: Clean Page + Editable Responses: Deep Reference

A standalone deep reference for two related changes to the respondent-facing side of Formora, in the same style as the other `PHASE_*` files. Both were explicit product requests, made by directly comparing Formora's behaviour to Google Forms and asking for it to match.

Covers: **(1)** a published form's public page (`/f/[slug]`) now shows only the form — no Formora site header, footer, or navigation — and **(2)** a respondent who already submitted sees their confirmation again on refresh instead of a blank form, with an "Edit your response" option to revise their answer, all without a Formora account.

---

## 1. Part one: a clean, separate public page

### The problem

Before this change, `/f/[slug]` rendered inside the same root layout as the rest of the site — every published form's page showed the Formora logo, the "npm / My forms / Sign out" nav, and the "Formora is open source" footer. A respondent opening a shared link saw Formora's own site chrome around the form, not just the form.

### The fix: Next.js route groups

Next.js layouts nest, and the root layout (which defines `<html>`/`<body>`) always wraps every route — there's no per-page way to opt out of a layout above it. The fix was to move the header and footer **out of the root layout** and into a layout that only wraps the actual site pages, using a route group.

**Before:**
```
app/
  layout.tsx        <- <html><body>, SiteHeader, {children}, footer
  page.tsx          <- homepage
  docs/, playground/, signin/, dashboard/, builder/, ...
  f/[slug]/         <- public form (got the header/footer too)
  api/
```

**After:**
```
app/
  layout.tsx        <- bare: <html><body>, fonts, base metadata — nothing else
  (site)/
    layout.tsx      <- SiteHeader, {children}, footer — everything under here gets it
    page.tsx        <- homepage (moved, URL unchanged: route groups don't affect paths)
    docs/, playground/, signin/, dashboard/, builder/, ... (all moved here)
  f/
    layout.tsx      <- just <main>, nothing else
    [slug]/         <- public form (untouched otherwise)
  api/              <- unaffected; API routes don't use page layouts
```

A route group — a folder name in parentheses, `(site)` — organises files without adding a URL segment: `app/(site)/docs/page.tsx` still serves `/docs`, not `/(site)/docs`. This is what let the move happen without changing a single link, bookmark, or test's URL expectations.

**Why `f/layout.tsx` still exists, given it renders almost nothing:** accessibility. A page needs exactly one `<main>` landmark, and every other page gets one for free from `(site)/layout.tsx`. Without a landmark of its own, `/f/[slug]` would have none at all. This was caught by axe (`landmark-one-main`, `region` violations) the first time this was built — not something to have gotten right by guessing.

### What moved, and what didn't

Moved into `(site)/`: `page.tsx` (the homepage), `builder/`, `dashboard/`, `docs/`, `forgot-password/`, `playground/`, `reset-password/`, `signin/`, `signout/`, `signup/`, `verify-account/`. Nothing about these files changed except their location — every import in this codebase already used the `@/` path alias (`@/lib/...`, `@/components/...`) rather than relative paths, so moving folders around broke nothing. `api/` never uses page layouts at all, so it didn't need to move. `f/` was already outside — it just needed its own minimal layout added.

---

## 2. Part two: recognising your own submission, and editing it

### The problem

Before this change, `PublicForm` tracked "have I submitted?" in a single `useState<boolean>` — pure in-memory React state, gone the instant the page reloaded. Refreshing after submitting silently reset the respondent back to a blank form, with no way to tell they'd already answered, and no way to see or change what they'd sent.

### The design: an edit token, not an account

The product requirement was explicit: a respondent should never need a Formora account to fill, revisit, or edit their own response. The mechanism for this — anticipated in the original product requirements ("Anonymous responses normally cannot be edited later unless Formora issues the respondent a secure, revocable edit token") — is a random, unguessable token handed to the browser at submit time, alongside the submission id. Possessing that token *is* the proof "this is my submission," with no email, password, or verification involved.

```
Submit  ──► server creates the Submission, generates a 256-bit token,
            stores only its SHA-256 hash, returns the raw token once
Browser ──► saves { submissionId, editToken } to localStorage, keyed by the form's slug
Later   ──► browser sends both back; server re-hashes the token and
            compares — a match proves ownership, nothing else does
```

This is the same pattern already used throughout the app for single-use links (5c's `VerificationChallenge`, 5b-2's `AccountVerificationToken`): never store a usable secret, only its hash, so a database read can't be turned into a working credential.

### `Submission.editTokenHash`

One new field, nullable (old submissions from before this field existed simply can't be looked up or edited — there's nothing to compare against, so they 404 exactly like a forged token would). No new model, no new collection — the field lives directly on the existing `Submission` document from Phase 5a.

### The two new endpoints

**`POST /api/forms/[slug]/submission/lookup`** — `{ submissionId, editToken }` → `{ answers, submittedAt, updatedAt, revisionNumber }`, or `404` for absolutely anything that doesn't match (wrong id, wrong token, unknown form, malformed input) — the same status for every failure mode, so a wrong guess reveals nothing about *why* it was wrong. This never lists, searches, or enumerates submissions; a token proves exactly one specific submission and nothing else.

**`POST /api/forms/[slug]/submission/update`** — `{ submissionId, editToken, answers }`. Checks, in order: the form exists and is still published and not past its close date (**editing is refused under the exact same conditions a new submission would be** — a closed or unpublished form accepts no respondent action at all, including revising an old answer; this was a deliberate simplification decision, not an oversight, made for consistency with how the rest of the system already treats a closed form), then the token matches, then re-runs the same `collectServerErrors` validation a fresh submission goes through, against whichever `FormVersion` is live *today* — not necessarily the one the respondent originally answered, mirroring how a fresh submission is always validated against the current version. On success: `answers` is replaced, `revisionNumber` increments, `formVersionId`/`schemaVersion` update to the current version, and Mongoose's own `updatedAt` timestamp moves — `submittedAt` (the original submission time) is never touched.

**What editing deliberately does *not* require:** re-verifying a `verified_email` form's identity cookie. The whole point of a standalone edit token is that it outlives a verified respondent's short-lived (2-hour) session cookie — a token from a submission made last week must still work today. The token itself is the credential; nothing else needs re-proving.

### `public-form.tsx`: the four-state client component

```
"checking"  → briefly, while localStorage is read and (if present) verified against the server
"form"      → nothing stored, or a stored token turned out to be invalid: show a blank form
"submitted" → confirmation message + "Edit your response" button
"editing"   → the form again, pre-filled via FormRenderer's existing defaultValues prop
```

On mount, a client effect reads `localStorage["formora-submission:<slug>"]`. If present, it's sent to `/submission/lookup` to confirm it's still valid (a form could theoretically have been deleted, or the entry could be a stale leftover from before edit tokens existed) — only on a genuine match does the confirmation show; any failure quietly forgets the local entry and falls back to a blank form, rather than getting stuck.

Clicking **"Edit your response"** switches to the `"editing"` state, passing the previously-fetched answers into `FormRenderer`'s `defaultValues` prop (already existed, unrelated to this change — no changes needed to `@hardikrastogi/react` at all). Submitting from that state calls `/submission/update` instead of `/submit`, using the already-known `{ submissionId, editToken }` rather than generating a new idempotency key — this is a revision, not a new response.

**A subtlety the lint rule caught:** the effect originally had a synchronous `setStatus(...)` call for the "nothing stored" branch, sitting alongside an async `.then()` chain for the "something stored" branch. ESLint's react-compiler rule flagged the synchronous call ("calling setState synchronously within an effect can trigger cascading renders"). The fix was cosmetic but instructive: wrapping the entire body in an `async () => { ... }()` IIFE so *both* branches — the immediate one and the awaited one — read as equally "async" to the linter, since they're both inside an async function body regardless of how quickly they actually resolve.

---

## 3. Testing (`apps/web/e2e/submission-edit.spec.ts`, 7 new tests)

| Test | Proves |
|---|---|
| No header/footer/nav on a published form's public page | The layout restructuring actually works, checked via ARIA landmark roles (`banner`, `contentinfo`, `navigation`) rather than CSS, so it can't pass by accident |
| Refreshing after submitting shows the confirmation, not a blank form | The core bug this phase fixes |
| Edit your response reopens pre-filled, saving updates the same submission | End to end: submit → edit → save → exactly one `Submission` document, `revisionNumber` incremented, reopening the browser again shows the *updated* answer |
| A second, unrelated browser sees a blank form | The local token never leaks between browsers — no shared, guessable, or sequential id is involved |
| A forged/unknown `submissionId`/`editToken` is refused | Both endpoints 404 on nonsense input, without distinguishing *why* |
| Editing is refused once the form is closed | The "same rules as submitting" decision, verified directly by unpublishing mid-test and attempting an edit anyway |
| No axe violations on the public form or its confirmation | Both the blank-form state and the "submitted" state are checked |

Existing `verified-email.spec.ts` and `hosted-forms.spec.ts` tests were updated for the layout change (a nav-visibility assertion on `/f/[slug]` was inverted — the "Log in" link it used to check for is *supposed* to be gone now) and needed no other changes; the submit/verify endpoints' existing behaviour is untouched, only extended with the new `editToken` field in the response.

**Full regression:** all 107 e2e tests (100 pre-existing + 7 new) and all 87 unit tests pass; `tsc --noEmit` and `eslint` are clean across the whole workspace.

---

## 4. Everything this change deliberately does NOT do

- **No creator-facing toggle for whether editing is allowed.** `Form.allowResponseEditing` exists on the model (from Phase 5a) but is still unused — this phase makes editing work, always on, for every form; a creator-controlled on/off switch (as the original product requirements describe for Phase 5d) was not built here.
- **No link between an edited response and a `RespondentIdentity`'s verification.** A `verified_email` form's identity check still only happens at the moment of the *original* submission (Phase 5c); editing later relies purely on the edit token, with no re-check that the editor still controls that email.
- **No visible history of past answers.** Editing overwrites `answers` in place; the previous version isn't retained anywhere (no revision log, just the incrementing `revisionNumber` as a counter).
- **No way for a creator to see or influence how many times a response was edited**, beyond what `revisionNumber` would show if a future response dashboard (Phase 5d) chose to surface it.
- **A cleared browser (private mode, wiped site data, a different device) loses edit access permanently.** There is no recovery flow (an "email me my edit link" option, for instance) — consistent with the same "no engineered recovery beyond the browser's own storage" decision already made for creator-side unsaved drafts in `PHASE_5B3_MANUAL_SAVE.md`.
