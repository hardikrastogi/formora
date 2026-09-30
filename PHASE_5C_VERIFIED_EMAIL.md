# Phase 5c — Verified-Email Respondents: Deep Reference

A standalone, exhaustive technical reference for Phase 5c, in the same style as `PHASE_5_HOSTED_FORMS.md` (5a) and `PHASE_5B_CREATOR_ACCOUNTS.md` (5b). Kept separate from `ROADMAP.md` (the plan) and `BUILD_LOG.md` (the running summary).

Covers 5c: **a second respondent access mode where the creator can require a respondent to verify their email before they see the form's questions.** The response dashboard, account linking to a `RespondentIdentity`, and response editing are Phase 5d. Verified phone is Phase 5e.

---

## 1. The big picture

Before 5c, every published form used the same rule: anyone with the link sees the questions and can submit. 5c adds a second rule a creator can choose per form:

- **`anyone`** (unchanged, still the default): open the link, see the form, submit.
- **`verified_email`**: open the link, see only the form's name and an email box. Type an email, get a one-time link, click it, and *then* the real form appears.

**One sentence per new concept:**
- **Access mode**: a setting on `Form`, `anyone` or `verified_email`, chosen by the creator and applied when they Publish.
- **Verification challenge**: one emailed link. Single-use, expires in 15 minutes.
- **Respondent identity**: "this email address has proven it controls itself," stored once per address, independent of any Formora account. A respondent using this flow never creates one.
- **Respondent session**: a small signed cookie proving "this browser verified this email for this one form," valid for 2 hours. Not a login — it grants nothing beyond submitting that one form.

**Why not reuse the creator sign-in (Auth.js) for this?** Auth.js sessions are tied to a Formora *account*, and the product requirement is explicit: a respondent must never be forced to create one. Building a separate, form-scoped, account-less verification path keeps that promise, and keeps a leaked respondent cookie from being useful anywhere except submitting that one form.

---

## 2. New environment variable

| Variable | Purpose | Local | Production |
|---|---|---|---|
| `APP_ORIGIN` | The address used to build links inside verification emails | optional (falls back to the dev server's own origin) | **required** |

**Why this can't just read the incoming request's Host header:** an attacker could request a verification email while forging the `Host` header to point at a look-alike domain. Auth.js's own emails have the same class of risk, but Phase 5c's endpoint is unauthenticated (anyone can ask for a link to any address), which makes it a more attractive target — so `appOrigin()` (`apps/web/src/lib/app-origin.ts`) refuses to trust the request at all. Order of preference: `APP_ORIGIN`, then Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`, then (development only) the request's own origin. Production throws if neither is set, rather than silently building a wrong link.

`apps/web/playwright.config.ts` sets `APP_ORIGIN` for the dev server it launches, so e2e-generated links always point at `localhost`, matching where the test browser actually is.

---

## 3. Shared email plumbing: `lib/email.ts`

5b's `sendMagicLink` had its own copy of the console/Resend transport logic. 5c needed the same delivery mechanism for a second kind of email (verification links), so that logic moved into a shared, message-shaped module:

```ts
sendEmail({ to, subject, text, html, link }): Promise<void>
```

- **`console` transport** (`EMAIL_TRANSPORT=console`, the development default): logs the link and writes `{to, url, subject, createdAt}` into the `dev_email_outbox` collection, which is how e2e tests "receive" mail.
- **`resend` transport**: POSTs to Resend's API, same as before.
- The **subject line is sanitised** (`\r\n` stripped, capped at 200 characters) before it reaches an HTTP header or a log line — the only place attacker-influenced text (the creator's chosen form name) reaches an email subject.
- `escapeHtml()` lives here too, and both `sendMagicLink` (5b) and the new verify-request route use it before interpolating the form name into HTML — the form name is creator-chosen text, and it appears in an email the *respondent* reads, so it is untrusted from the respondent's point of view.

`apps/web/src/lib/auth/send-magic-link.ts` (5b) now just builds a message and calls `sendEmail`; its behaviour is unchanged.

---

## 4. Data model

### `Form` (extended)

One new field:

```ts
accessMode: "anyone" | "verified_email"   // default: "anyone"
```

Set only when the publish request includes it; republishing without specifying `accessMode` **keeps the form's current mode** rather than silently resetting it to `anyone`. That is deliberate: a creator who republishes after an edit must not accidentally reopen a form they locked down.

### `RespondentIdentity` (new)

```ts
type: "email"
normalizedValue: string        // lowercased, trimmed
verifiedAt: Date               // first time this address ever verified anything
lastVerifiedAt: Date           // updated on every re-verification
linkedAccountId: string | null // set in Phase 5d
```

Unique index on `(type, normalizedValue)`, so the same address always maps to the same one row, across every form it ever verifies for. This is intentionally **not a Formora account** — it has no password, no login, no dashboard. It exists purely so 5d can later match "an account with this verified email" to "past submissions verified with this email," per the product requirement that this matching must only ever happen through a proven identity, never by reading a plain answer field that happens to contain an email address.

### `VerificationChallenge` (new)

```ts
formId, email, tokenHash, expiresAt, usedAt, ipHash, createdAt
```

- **Only a SHA-256 hash of the token is stored**, matching the `AUTH_SECRETE`-adjacent lesson from 5b about never storing a usable secret at rest: a database read (backup, leaked snapshot, misconfigured access) yields hashes that cannot be turned back into working links.
- **`ipHash`**, not the raw IP: a keyed HMAC (`hashIp`, using a key derived from `AUTH_SECRET`, never the raw IP), enough to count requests per network address for rate limiting without storing addresses.
- **A TTL index** (`expireAfterSeconds: 7200`) lets MongoDB delete rows itself two hours after creation — comfortably longer than every rate-limit window that reads them, so cleanup never races a still-relevant limit check.
- **Compound indexes** `(formId, email, createdAt)` and `(ipHash, createdAt)` are what the rate limits query against.

---

## 5. The respondent session cookie: `lib/respondent-session.ts`

Format: `<identityId>.<formId>.<expiresAtMs>.<signature>`, where the signature is an HMAC-SHA256 over the first three parts, using a key **derived from** `AUTH_SECRET` (via one extra HMAC step with a fixed label) rather than reusing it directly — so the same secret is never used raw for two different signing jobs.

```ts
createRespondentToken(identityId, formId, now?): string
verifyRespondentToken(token, formId, now?): string | null   // returns identityId or null
```

`verifyRespondentToken` checks, **in this order**: the token has exactly 4 dot-separated parts; the signature matches (compared with `timingSafeEqual`, so checking it takes the same time whether the guess is close or wildly wrong); the form id in the token equals the form id being checked *now*, not just any form; the expiry hasn't passed. Any failure returns `null` — the caller never learns *which* check failed.

**One cookie per form** (`fr_<formId>`), not one cookie for everything: a respondent verifying for form A gets a cookie useless for form B, even if both forms happen to accept the same email address. This is enforced twice — once in the cookie's own signed payload (the form id it was issued for), and again by the cookie's *name* including the form id, so a forged `Cookie` header naming a different form's cookie name doesn't even get read for the wrong form.

**Lifetime:** 2 hours (`RESPONDENT_SESSION_SECONDS`). Long enough to fill out a form after verifying without re-verifying mid-way, short enough that a leaked cookie doesn't work indefinitely.

---

## 6. The two verification endpoints

### `POST /api/forms/[slug]/verify/request`

Body: `{ email }`. Always returns `200 { ok: true }` on success and reveals nothing about whether that address has been seen before — the product's anti-enumeration requirement.

Checks, in order:
1. Body parses as JSON.
2. `normalizeEmail` accepts it (trimmed, lowercased, matches a basic `x@y.z` shape, at most 254 characters — the longest an email standard allows). Rejects: `422`.
3. The form exists, is published, and `accessMode === "verified_email"`. Otherwise: `404`, the same code whether the slug doesn't exist or is a plain `anyone` form — this endpoint must not be usable to probe which forms exist or what mode they use.
4. **Rate limits**, read from stored challenges so they hold up across server restarts and multiple server instances:
   - **60-second cooldown** per `(form, email)` — checked against the *most recent* challenge only.
   - **5 per hour** per `(form, email)`.
   - **20 per hour** per hashed IP, across *all* addresses — stops one person spraying links at many made-up addresses.
   - A limit hit returns `429` with a `Retry-After` header (seconds).
5. Create the challenge (random 256-bit token, hashed before storage) and send the email, with the form's own name in the subject and body (escaped for HTML).

### `POST /api/forms/[slug]/verify/confirm`

Body: `{ token }`. This is the request the **"Continue to form" button** makes — not what loading the link does. Checks:
1. Token is a string of a plausible length (20 to 200 characters). Anything else: `400`.
2. Form exists, published, `verified_email` mode. Otherwise `404`.
3. **One atomic `findOneAndUpdate`** does both the check and the consumption: match a challenge for this form with this token's hash, `usedAt: null`, and `expiresAt` in the future, and set `usedAt` in the same operation. Because this is one database operation, two simultaneous requests with the same token (a double-click, or a genuine replay attempt) cannot both see `usedAt: null` and both succeed — MongoDB serialises the two updates, and the loser gets no document back. That failure path returns `410`, the same code used for "expired," so a client can't distinguish "used" from "expired" from the status alone.
4. On success, **upsert** the `RespondentIdentity` for that email (`verifiedAt` only set on first creation via `$setOnInsert`, `lastVerifiedAt` always bumped), then set the respondent cookie and return `200`.

---

## 7. Why loading the email link doesn't burn it

The link in the email points at a page (`/f/[slug]/verify`), not directly at the confirm API. That page:
- Sets `robots: { index: false, follow: false }` and `referrer: "no-referrer"`, so the secret-bearing URL is kept out of search indexes and is never leaked as a referrer if the page links elsewhere.
- Shows a **"Continue to form"** button. Only clicking it (`ContinueButton`, a client component) sends the `POST /verify/confirm` that actually consumes the token.

This matters because mail clients, corporate security scanners, and link-preview bots routinely **GET every URL in an email automatically**, before a human ever opens it. If the link itself performed the verification (as a GET), the very first automated fetch would burn the one-time token, and the real respondent would find it already used. Making consumption a deliberate button press, over POST, is what protects against that — the same reasoning Auth.js already uses for its own callback design, applied here explicitly since this is hand-rolled.

---

## 8. The public page: `/f/[slug]`

`page.tsx` now branches on `form.accessMode`:

- **`anyone`**: unchanged from 5a/5b.
- **`verified_email`**: reads the respondent cookie server-side (`verifyRespondentToken`), looks up the `RespondentIdentity` it names.
  - **Not verified:** renders `<VerifyGate>` — the form's name and an email box — and **stops there**. The form's field definitions are never sent to the browser at all in this case, satisfying "a sensitive form's questions stay private until verified" (the check happens in the server component, before `<PublicForm>` is ever rendered).
  - **Verified:** renders the real form, plus a line stating which email was verified, so a respondent can see they don't need to re-enter it and can tell if they verified the wrong address.

`VerifyGate` (`f/[slug]/verify-gate.tsx`) is a small client component: an email input, a submit handler that calls `verify/request`, and a "Check your email" confirmation state that deliberately doesn't reveal whether the address was known before.

`f/[slug]/verify/page.tsx` and `continue-button.tsx` implement the Continue page from section 7. On success it navigates to `/f/[slug]` and calls `router.refresh()`, so the server component re-reads the (now-set) cookie and renders the real form.

---

## 9. Enforcement on submit: `POST /api/forms/[slug]/submit`

The **server**, not the page, is what actually protects a `verified_email` form — the public page's gate is a UX convenience, never the security boundary. Added near the top of the handler, right after the existing published/closed checks and before loading the version:

```ts
if (form.accessMode === "verified_email") {
  const cookie = (await cookies()).get(respondentCookieName(String(form._id)))?.value;
  respondentIdentityId = verifyRespondentToken(cookie, String(form._id));
  if (!respondentIdentityId) {
    return 401 { error: "...", code: "verification_required" }
  }
}
```

A verified submission's `respondentIdentityId` is stored on the `Submission` document (the field already existed on the model since 5a, reserved for this). An `anyone`-mode form still stores `null` there, unchanged.

---

## 10. The builder: choosing an access mode

`builder-page.tsx` holds a small piece of local state, `accessMode`, seeded from the form's current value (`initialAccessMode`, threaded down from `builder/[id]/page.tsx`'s database read). A `<select>` above the canvas lets the creator choose "Anyone with the link" or "Only people who verify their email," and `publishForm` sends it along with the definition on every Publish call. The dashboard (`dashboard/page.tsx`) tags a live verified-email form with "(verified email)" next to its link, so a creator scanning their form list can tell at a glance which ones are locked down.

---

## 11. Testing: `apps/web/e2e/verified-email.spec.ts` (14 tests)

| Test | Proves |
|---|---|
| Unverified visitor sees only the gate | The field list is never sent to the browser pre-verification |
| Submit without a cookie | Server-side 401, not just a hidden UI |
| Full flow, end to end | Email → link → Continue → form → submit, and the stored submission's `respondentIdentityId` matches the identity created for that email |
| Loading vs. clicking | A plain GET on the emailed link can happen twice without effect; pressing Continue (POST) works once, then 410s |
| Expired link | A challenge past `expiresAt` is refused (410) |
| Cross-form and malformed tokens | A token from form A doesn't verify form B (410); a well-formed but wrong token fails (410); a too-short one is rejected before any lookup (400) |
| Forged/reused cookies | A cookie with a substituted identity, a pushed-out expiry, or garbage all fail (401); a cookie earned on one form fails on another, even naming that form's own cookie name |
| Cooldown and per-address cap | A second request inside 60 seconds gets 429 with `Retry-After`; a different address is unaffected; a 6th request within an hour is capped |
| Per-IP cap | 20 requests across 20 different addresses from one address succeed, the 21st is capped |
| Bad input | An invalid email (422), a missing field (422), asking on an `anyone`-mode form (404), an unknown slug (404), an invalid `accessMode` value sent to publish (422) |
| Mode switching | Republishing without `accessMode` preserves the existing one; explicitly republishing as `anyone` reopens submissions immediately |
| Builder UI | Choosing the mode in the dropdown and publishing actually locks the public link, and reloading the builder shows the choice was saved |
| Accessibility | axe finds no violations on the email-gate page or the Continue page |

All 14 pass, alongside all 71 pre-existing e2e tests (85 total) and all 85 unit tests, with `tsc --noEmit` and `eslint` clean across the workspace.

### Test helper additions (`e2e/auth-helpers.ts`)

`withDb(fn)`: opens a throwaway `MongoClient` against the same URI the app uses, runs `fn`, closes it — used to seed rate-limit fixtures directly and to read back stored documents (identities, submissions, challenges) for assertions that the API alone can't answer directly (e.g., "does the submission's identity id match the one that got created?").

---

## 12. Local development note: MongoDB moved from Docker to Atlas

5a and 5b assumed a local `mongo:7` Docker container. While building 5c, that stopped working: the machine's C: drive filled up (turbo/npm caches), which caused Docker Desktop itself to stop starting, and — separately — the D: drive Docker's data and, unrelatedly, the machine's Git install lived on was later merged into C: to reclaim space, which erased both.

**Current setup:** `apps/web/.env.local`'s `MONGODB_URI` now points at a **separate Atlas database** (`formora_dev`, same cluster as production, different database name), not the production database and not local Docker. This keeps throwaway e2e data (random test forms, submissions, accounts, verification challenges — dozens of documents per test run) completely isolated from real data. The `.env.example` placeholder is unaffected; only the real local secret file changed. Two Atlas passwords were rotated during this move after being pasted into chat by mistake — a reminder that a password typed anywhere in this conversation must be treated as burned, exactly like the `AUTH_SECRET` incident in 5b.

A very small number of e2e test flakes were observed against Atlas (network round-trip time vs. essentially-zero for local Docker) and disappeared on rerun; nothing in this phase's design assumes zero-latency database calls, so this is expected variance, not a masked bug.

---

## 13. Everything Phase 5c deliberately does NOT do yet

- **No account linking.** `RespondentIdentity.linkedAccountId` exists on the model but is never set — that's Phase 5d, when a creator account registers the same verified email.
- **No "Your responses" list for a respondent.** Nothing shown here surfaces past submissions back to the person who made them.
- ~~No response editing.~~ Fixed shortly after this phase, for both access modes: a verified respondent can now revisit and change a submission via a per-submission edit token, the same mechanism `anyone`-mode respondents get. See `PHASE_5_PUBLIC_FORM_UX.md`. Still missing: a creator-facing on/off toggle for this (`allowResponseEditing` remains unused) and tying the edit itself to re-verifying the respondent's identity — both still 5d.
- **No creator-facing indicator of *how many* people were emailed but never completed verification** (i.e., no funnel/drop-off visibility) — only completed verifications and submissions are stored.
- **No phone verification.** That's Phase 5e, structurally similar (a `type: "phone"` on `RespondentIdentity`) but with SMS delivery instead of email.
- **No UI to see or revoke an in-progress respondent session** from the creator's side.
- **The 60-second/5-per-hour/20-per-hour numbers are fixed constants**, not configurable per form or by an admin.
