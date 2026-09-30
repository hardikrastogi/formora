# Phase 5d — Response Dashboard, Account Linking, and Editing: Deep Reference

A standalone, exhaustive technical reference for Phase 5d, in the same style as the other `PHASE_*` files.

Covers 5d: **a per-form response dashboard (list, search, sort, pagination, detail view, CSV export), the `allowResponseEditing` creator toggle, and account linking** — connecting a verified respondent identity to a Formora account with the same email, in whichever order the two come into existence.

Before this phase, Formora could collect responses but gave the creator no way to see them except opening MongoDB directly. This is the phase that makes the product actually usable day to day.

---

## 1. `allowResponseEditing`: turning an always-on feature into a real toggle

A previous session built the mechanics of response editing (a per-submission edit token, `POST /api/forms/[slug]/submission/update`) but wired nothing up to gate it — every form allowed editing, unconditionally. `Form.allowResponseEditing` existed on the schema since Phase 5a, defaulting to `false`, but nothing ever read it.

**This is now enforced.** The update route checks `form.allowResponseEditing` before touching a submission; a valid edit token is no longer sufficient by itself. The builder gained a checkbox ("Allow respondents to edit their response after submitting"), with no access-mode restriction — unlike `limitOneResponsePerRespondent`, the edit-token mechanism works identically for anonymous and verified respondents, so there's nothing mode-specific to gate.

**A deliberate behaviour change, not a bug:** because the schema always defaulted this to `false`, every form that existed before this phase now has editing turned off by default, even if it previously worked (since the earlier always-on behaviour ignored the flag entirely). A creator relying on that has to explicitly turn the checkbox on and republish. This was a considered choice — matching the schema's own original, more conservative intent — not an oversight.

The public form page reads the flag through `getPublishedFormBySlug`'s cached shape (a new `allowResponseEditing: boolean` field) and only renders the "Edit your response" button when it's true; the toggle is enforced both in the UI (no button shown) and on the server (a direct API call with a valid token still gets `403` if the form doesn't allow it).

---

## 2. The response dashboard

### Ownership: `lib/db/owned-form.ts`

One function, `getOwnedForm(slug, userId)`, used by every response list/detail/export endpoint and page. A form that exists but belongs to someone else returns exactly the same `null` as a form that doesn't exist at all — the same anti-enumeration rule publish/unpublish already followed, now extended to reading responses.

### Cursor pagination: `lib/db/responses.ts`

The list never loads a whole form's responses into memory. It's paginated with an opaque cursor — base64 of `{ t: submittedAt ISO, i: _id }` — rather than a page number, because a page number breaks the moment new responses arrive between page loads (everything shifts by one). The cursor instead says "give me everything strictly before/after this exact point," which stays correct regardless of what's been inserted since.

**Why `_id` as a tiebreaker, not just `submittedAt`:** two responses can share the same millisecond timestamp. Sorting by `{ submittedAt, _id }` together (and comparing both in the cursor's `$or` query) keeps pagination stable even then — no response can ever be skipped or repeated across pages because of a timestamp collision. This is also why `Submission`'s old `{formId, submittedAt}` index was replaced with `{formId, submittedAt, _id}`.

**Search** is a plain case-insensitive substring match against a new `Submission.searchText` field — a lowercased, space-joined copy of every string/number/boolean answer value, recomputed on every submit and every edit (`lib/submission-search.ts`). This is explicitly not a real search engine or a text index; it's proportionate to how few responses one form realistically has. A regex substring match doesn't use an index the way a prefix match would, but it's filtered by `formId` first (which is indexed), so the actual regex scan is bounded to one form's own responses, not the whole collection.

**Date-range filtering** (`from`/`to` query params) narrows by `submittedAt`.

**`totalCount`** is computed on every request (a `countDocuments` alongside the `find`), with the same filters applied — so it updates live as someone searches or filters, at the cost of one extra query per page load. Reasonable at the scale a single form's response count realistically reaches; would need reconsidering (caching, or only computing on the first page) at genuinely large scale.

### The three endpoints

| Route | Returns | Notes |
|---|---|---|
| `GET /api/forms/[slug]/responses` | Paginated responses + the current form's field metadata (for column headers) | Query params: `cursor`, `limit` (max 100), `search`, `sort` (`asc`/`desc`), `from`, `to` |
| `GET /api/forms/[slug]/responses/[submissionId]` | One response's full answers | Labelled against the `FormVersion` **that specific response actually answered** — not necessarily the form's current version, so labels stay correct even after the creator changes the form later |
| `GET /api/forms/[slug]/responses/export` | A streamed CSV | See section 3 |

All three: `401` signed out, `404` for a nonexistent form, someone else's form, or (for detail) a response that doesn't belong to this form — every failure mode looks identical from the outside.

### The pages

`/forms/[slug]/responses` — a server component that checks ownership and 404s early, rendering a client component (`ResponsesList`) that owns the search box (debounced 300ms), the sort toggle, and a "Load more" button that appends the next cursor page to what's already shown. `/forms/[slug]/responses/[submissionId]` — a fully server-rendered detail view (no client interactivity needed for a single read).

The dashboard (`/dashboard`) now links to `/forms/<slug>/responses` for any form that has ever been published, whether or not it's currently live — past responses don't disappear just because the form was unpublished since.

---

## 3. CSV export — and what it deliberately isn't

`GET /api/forms/[slug]/responses/export` streams a CSV using a `ReadableStream`, processing submissions in fixed-size batches (500 at a time) so memory use stays flat regardless of how many responses exist — a form with ten responses and a form with a hundred thousand both use roughly the same amount of memory to export.

**Two passes over the data, on purpose.** The column headers need to be known before the first data row is written, but the exact set of answer keys isn't fully known until every submission has been read — an older `FormVersion` might have had fields that don't exist on the form today, and those answers shouldn't be silently dropped just because the form changed. So there's a first pass purely to discover any such "extra" keys, then a second pass that actually writes rows. This means every submission is read from MongoDB twice. Acceptable at the scale this endpoint already targets; a genuinely large export would want a different approach (a fixed schema decided up front, or a single pass that accepts a slightly messier column set).

**This is a synchronous download, not a background job — and the roadmap originally called for the latter ("Async CSV/Excel export for large response sets").** Building a real async job needs persistent job state, a way to notify the creator when it's ready (polling or a webhook), and — since Formora deliberately has no Redis/queue infrastructure (see the same deferral reasoning in `ROADMAP.md`'s hardening backlog) — nowhere obvious to run it. Building that now would be solving a problem this app doesn't have yet: a synchronous stream handles every realistic case today, and Vercel's function time limit is the actual ceiling on "how large is too large" — a limit this phase accepts rather than works around. If a real creator ever hits it, that's the moment to build the async version, not before.

**No `.xlsx` (native Excel) output — CSV only.** No spreadsheet-writing library was already a dependency, and CSV opens correctly in Excel, Google Sheets, and Numbers, which covers what "Excel export" is actually for in practice. A genuinely native `.xlsx` (with formatting, multiple sheets, etc.) would need a new dependency and wasn't built.

---

## 4. Account linking

### The rule

The product requirement is specific: linking must only ever happen through a **proven** email match — a `RespondentIdentity.normalizedValue` (set only after someone clicked a real verification link) matching a creator account's own email — and never by reading an email address that happens to appear inside an ordinary form answer.

### `lib/account-linking.ts`

One function, `linkRespondentIdentity(email)`: looks up both a `RespondentIdentity` and a creator account (`users` collection) by the same normalized email; if both exist and the identity isn't already linked, sets `RespondentIdentity.linkedAccountId`. Idempotent and cheap to call speculatively — it's a no-op unless both sides genuinely exist.

### Called from three places, because either order is possible

| Trigger | Where | Why |
|---|---|---|
| A password-signup account is confirmed | `POST /api/account/verify`, right after `upsertVerifiedPasswordUser` | This path bypasses Auth.js's adapter entirely (see `PHASE_5B2_PASSWORD_AND_GOOGLE_AUTH.md`), so it can't rely on the adapter's own creation event |
| A magic-link or Google account is created | `auth.ts`'s new `events.createUser` | Fires only when the **adapter** creates a brand-new user — covers exactly the two paths that go through it |
| A respondent verifies an email for the first time | `POST /api/forms/[slug]/verify/confirm`, right after the `RespondentIdentity` upsert | Covers the case where a creator account already existed *before* anyone ever verified that email as a respondent |

**Why not put the call inside `lib/auth/users.ts` itself, next to `upsertVerifiedPasswordUser`:** that would create a circular import — `account-linking.ts` needs `findUserByEmail` from `users.ts`, and `users.ts` would need `linkRespondentIdentity` from `account-linking.ts` right back. The call was placed in the **route** that calls `upsertVerifiedPasswordUser` instead, keeping `users.ts` a one-way dependency (a pure data-access module with no awareness of the linking feature built on top of it).

### `/my-responses`

Shown to a signed-in creator: every submission whose `respondentIdentityId` matches the one `RespondentIdentity` linked to their account (there's at most one, since a creator only has one account email). **Only the form name and the submission date are shown** — the page never renders `answers` at all, not even conditionally; there's no code path in this file that touches that field. An e2e test asserts this directly, by checking a deliberately-submitted secret string never appears anywhere in the rendered page.

---

## 5. Testing

**`e2e/health-and-limits.spec.ts`** was extended earlier (before this phase's core work) with `maxResponses`/`limitOneResponsePerRespondent` coverage — unrelated to the dashboard itself, already in place.

**`e2e/responses.spec.ts` (8 tests):** listing with correct default sort order, search narrowing and finding nothing, the sort toggle, cursor pagination (verified directly against the API — two pages, no overlap, correct `totalCount`), the detail view's field labelling, the CSV export's exact header row and content, non-owner `404`s across all three endpoints *and* both pages (not just the API), and the dashboard's "Responses" link appearing for a published form.

**`e2e/account-linking.spec.ts` (5 tests):** both orderings (respondent-first, account-first), a sanity check that unrelated emails are never linked, `/my-responses` showing the form name while never leaking the actual answer text, and the empty state for an account with no linked identity.

**A real cross-page-navigation bug caught while writing these tests:** several early test drafts signed in via a separate `playwright.request.newContext()` (an API-only context) and then tried to `page.goto()` an authenticated page — the browser `page` was never actually signed in, since the session cookie lived in the *other* context. Every test that navigates a real page now signs in through `page.request` specifically, so the cookie lands where the navigation actually happens.

**Full regression:** 133 e2e tests (all passing on a clean rerun — one transient failure on the first full run, under the added parallel load of two new spec files, did not reproduce), 87 unit tests, `tsc --noEmit`, and `eslint` all clean.

---

## 6. Everything Phase 5d deliberately does NOT do yet

- **No `formId + responseId` compound index** as originally listed in the roadmap's own wording — replaced with the more precise `{formId, submittedAt, _id}` once cursor pagination's actual query shape was worked out; a bare `responseId` index wouldn't have matched anything this phase actually queries by.
- **No async background-job export.** See section 3 — a deliberate, documented deferral, not an oversight.
- **No `.xlsx` file generation**, CSV only.
- **No re-verification tied to editing for `verified_email` forms specifically.** The original roadmap wording asked for `allowResponseEditing` to be "tied to `RespondentIdentity` re-verification" for verified-email forms — this phase's toggle applies uniformly to both access modes via the same edit-token mechanism; a verified respondent doesn't need to re-verify their email to use their edit token, which is intentional (see `PHASE_5_PUBLIC_FORM_UX.md`'s reasoning: the token is designed to outlive the respondent's short session cookie) but is a looser guarantee than "re-verification" implies.
- **No UI for the `from`/`to` date-range filter** the API supports — implemented server-side, not yet exposed as date pickers in `ResponsesList`.
- **No pagination or lazy-loading inside the detail view or export for a single response with an enormous number of fields** — not a realistic scenario given how `FormDefinition`s are built today, so not specifically handled.
