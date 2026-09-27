# Phase 5b-2 — Password and Google Sign-In for Creators: Deep Reference

A standalone, exhaustive technical reference for Phase 5b-2, in the same style as the other `PHASE_*` files. Kept separate from `ROADMAP.md` (the plan) and `BUILD_LOG.md` (the running summary).

Covers 5b-2: **email+password signup/login with a forgot-password flow, and Google sign-in, added alongside 5b's existing magic link for creator accounts.** All three methods now work on the same account. Also folds in three small product cleanups requested at the same time: removing the redundant "Builder" nav link, moving developer-only "Docs"/"Playground" out of the header, and a placeholder templates section on the homepage.

---

## 1. The big picture

5b shipped creator accounts with exactly one sign-in method: an emailed magic link, no password. This phase adds two more, without removing that one:

- **Email + password**, with its own signup (email-verified before the account can be used) and a forgot-password flow.
- **Google** ("Continue with Google"), which NextAuth handles almost entirely itself.

All three end up on the same underlying account record when the email matches: signing up with a password on an email that already has a magic-link-only account attaches a password to *that* account rather than creating a second one, and likewise Google sign-in on an email that already exists links to it (NextAuth's adapter does this automatically for OAuth).

**A significant, non-obvious side effect:** NextAuth requires JWT sessions the moment any Credentials provider is registered — it cannot persist a Credentials-based sign-in as a database session (there is no adapter-recognized way to do so safely). Since providers share one session strategy, this took *every* sign-in method off database sessions and onto JWT, including the existing magic link and the new Google provider. This was the single riskiest change in this phase, since 5b and 5c's entire test suite implicitly depended on however sessions used to work. It was re-run in full after the switch — see section 8.

---

## 2. New environment variables

| Variable | Purpose | Required? |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client id from Google Cloud Console | Optional — Google sign-in is hidden everywhere when unset |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Optional, same as above |

To create them: Google Cloud Console → **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**, with an authorized redirect URI of `<APP_ORIGIN>/api/auth/callback/google` (e.g. `https://formora-web.vercel.app/api/auth/callback/google` in production, `http://localhost:3100/api/auth/callback/google` for the e2e server). `auth.ts` checks both variables at startup and only pushes `Google` into the provider list when both are present — an incomplete or absent configuration degrades to "no Google button" rather than a crash, the same defensive pattern already used for `EMAIL_TRANSPORT`.

No new variable was needed for password auth: it reuses `AUTH_SECRET` (indirectly, for signing respondent-style cookies — not used here — and for nothing new) and the existing `EMAIL_TRANSPORT`/`RESEND_API_KEY`/`EMAIL_FROM`/`APP_ORIGIN` set up in 5b/5c for sending verification and reset emails.

---

## 3. Why JWT sessions, and what changed because of it

### The constraint

NextAuth's Credentials provider has no inherent unique id it can hand to an adapter to create a durable session row — the adapter's `createSession` expects a real user, and NextAuth deliberately refuses to wire that up automatically for Credentials, to stop a misconfigured Credentials provider from minting sessions for made-up users. The practical rule: **the moment a `Credentials` provider is in the `providers` array, `session.strategy` must be `"jwt"`.** This is global, not per-provider — every provider now issues a JWT-backed session, encrypted and signed into the `authjs.session-token` cookie itself, instead of a row in the `sessions` collection.

### What stayed the same

- `getUserId()` (`lib/auth/session.ts`) — unchanged. `auth()` still returns `session.user.id` or nothing; callers never see the strategy underneath.
- The `MongoDBAdapter` is still wired up and still does real work: storing `users`, linking Google `accounts`, and issuing/consuming the Email provider's verification tokens. Only *session storage* moved out of it.
- Sign-out: unchanged in effect. With database sessions, `signOut()` deletes the `sessions` row; with JWT, there is no row — `signOut()` just clears the cookie. Either way, the browser ends up signed out.

### What changed in `auth.ts`'s callbacks

```ts
callbacks: {
  async jwt({ token, user }) {
    if (user?.id) token.sub = user.id;
    return token;
  },
  session({ session, token }) {
    if (token.sub) session.user.id = token.sub;
    return session;
  },
},
```

Previously the `session` callback received `{ session, user }` (`user` being the adapter's database row, looked up by session id). Now it receives `{ session, token }`, and the account id has to be threaded through the JWT itself: `jwt()` runs first (right after sign-in, when `user` is available) and copies the id onto `token.sub`; `session()` runs after that, copying it from the token onto the session object every request needs. `token.sub` doubles as the JWT's standard "subject" claim, so this didn't need a custom field.

---

## 4. Data model: passwords live on the existing `users` collection

No new Mongoose model for the account itself — `passwordHash` is added directly as an extra field on the same native-driver `users` collection the MongoDB adapter already owns (`_id`, `email`, `emailVerified`, `image`, ...). Mongo is schemaless, so this needed no migration; a magic-link-only account simply has no `passwordHash` key until one is added.

**Why not a Mongoose model, when everything else in this app uses Mongoose?** Because this collection isn't this app's to define — its shape is the adapter's contract with NextAuth. `lib/auth/users.ts` reads and writes it through the native MongoDB driver (`getMongoClient()`, the same connection the adapter itself uses), never through Mongoose, so there's no risk of a Mongoose schema silently stripping fields NextAuth relies on.

```ts
findUserByEmail(email): Promise<AccountUser | null>
findUserById(id): Promise<AccountUser | null>
upsertVerifiedPasswordUser(email, passwordHash): Promise<AccountUser>   // create-or-attach + set emailVerified
setUserPassword(email, passwordHash): Promise<void>                     // reset only
```

`upsertVerifiedPasswordUser` is the one function both fresh signups and "add a password to my magic-link account" go through — it doesn't need to know which case it's in. It always sets `emailVerified` (via `$setOnInsert` it's really only relevant for a genuinely new user; for an existing verified user it's already true, and setting the same timestamp field to "now" again is harmless — see section 6 for why re-verification happens anyway).

### `AccountVerificationToken` (new Mongoose model)

Deliberately shaped like 5c's `VerificationChallenge`, because it solves the identical problem for a different audience (creators, not respondents):

```ts
purpose: "signup" | "reset"
email: string
pendingPasswordHash: string | null   // "signup" only — see below
tokenHash: string                    // SHA-256 of the token; the raw token is never stored
expiresAt: Date                      // 15 minutes
usedAt: Date | null                  // single-use
ipHash: string                       // keyed hash, for rate limiting without storing raw IPs
createdAt: Date
```

Indexes: `(purpose, email, createdAt)` and `(ipHash, createdAt)` for the rate-limit queries, plus a TTL index (`expireAfterSeconds: 7200`) so expired rows clean themselves up.

**Why `pendingPasswordHash` lives on the token, not written to the account immediately:** the password is hashed *at signup time*, before the email is verified, and held on the unconsumed token. Nothing about the account changes — no user document is created or touched — until the link is actually clicked. An unverified signup attempt leaves no trace on the `users` collection at all; the account only comes into existence (or gets its password) at the moment `consumeAccountToken` succeeds.

---

## 5. `lib/auth/account-tokens.ts`: shared plumbing for signup and reset

```ts
requestAccountToken(purpose, email, request, { pendingPasswordHash? }): Promise<void>
consumeAccountToken(purpose, token): Promise<{ email, pendingPasswordHash } | null>
```

Rate limits — identical numbers to 5c, and deliberately scoped **per purpose**, so a burst of signup attempts for an address can't exhaust that same address's forgot-password budget or vice versa:

- 60-second cooldown between two requests for the same `(purpose, email)`.
- 5 requests per hour for the same `(purpose, email)`.
- 20 requests per hour per hashed IP, across every address and both purposes together (one counter for the IP, not split by purpose — a single network address spamming *either* endpoint is still one abuse pattern).

`requestAccountToken` throws a typed `RateLimitedError` (carrying `retryAfterSeconds`) rather than returning a sentinel value, so a route handler can catch it once and turn it into a `429` with a `Retry-After` header — the same shape 5c's own rate-limit responses use.

`consumeAccountToken` does the check-and-consume as one atomic `findOneAndUpdate` (match `usedAt: null` and `expiresAt` in the future, set `usedAt` in the same operation), for the identical reason as 5c: two simultaneous uses of the same token — a double-click, a replay — can only ever have one winner, and MongoDB serialises it for us instead of needing a lock.

---

## 6. The four API routes

All four follow the same shape as 5c's `verify/request` and `verify/confirm`: a route handler, `Request`-based (so `appOrigin(request)` and `clientIp(request)` work unchanged), returning JSON with the same status-code conventions (`422` bad input, `429` rate-limited, `410` expired/used, `404` not applicable).

### `POST /api/account/signup` — `{ email, password }`

1. Validate email shape and password length (`isValidPassword`: 8–200 characters).
2. If an account with this email **already has a password**, refuse with `409` ("An account with this email already exists. Log in instead.") — this is the one place in the whole signup/reset flow that *does* reveal something (that a password-protected account exists for that address), and deliberately so: it's no more revealing than a login page's "wrong password" already is, and staying silent here would just email a doomed link to no effect.
3. Otherwise (no account, or an account without a password yet), hash the password immediately and create a `signup` token carrying that hash. Always answers `200` past this point, regardless of whether the email is new or belongs to an existing magic-link account — that distinction is not revealed.

### `POST /api/account/verify` — `{ token }`

The "Continue" button's endpoint (see section 7 for why it's a button, not the link itself). Consumes the `signup` token; on success, calls `upsertVerifiedPasswordUser(email, pendingPasswordHash)` and returns the email so the confirmation page can show it. `410` for anything expired/used/nonexistent, `400` for a token that's obviously malformed (wrong length) before touching the database at all.

### `POST /api/account/forgot-password` — `{ email }`

Always answers `200`. Internally, only actually creates a `reset` token and sends an email **if the account has a password set** — a magic-link-only account or a nonexistent address both get the same silent success, so this endpoint cannot be used to learn which addresses exist or how they authenticate.

### `POST /api/account/reset` — `{ token, password }`

Consumes the `reset` token, then `setUserPassword(email, hash)`. Unlike signup, this doesn't touch `emailVerified` (it's already true — you can't have a password to reset without having verified once already) and doesn't need an upsert, since the account already exists.

---

## 7. Why the emailed links open a page with a button, not the action itself

Exactly 5c's reasoning, applied to two new link types. `/verify-account?token=...` and `/reset-password?token=...` are both pages, not API endpoints, and both set `robots: { index: false, follow: false }` and `referrer: "no-referrer"`. Loading either page performs **no** server-side action — only clicking the page's button (`ContinueVerification`, `ResetPasswordForm`) sends the `POST` that actually consumes the token. This is what stops a mail client's automatic link-scanning from silently burning a real user's one-time link before they ever see it.

`/reset-password` differs slightly from `/verify-account`: instead of a bare "Continue" button, it's a real form (new password + confirm), because setting a password needs more input than clicking through. The click-to-consume rule still holds — nothing happens until the form is submitted.

---

## 8. Password strength and hashing

`lib/auth/password.ts`:

```ts
MIN_PASSWORD_LENGTH = 8
isValidPassword(x): x is string     // 8–200 characters, nothing else enforced
hashPassword(password): Promise<string>   // bcrypt, cost factor 12
verifyPassword(password, hash): Promise<boolean>
```

**Why `bcryptjs` and not native `bcrypt`:** pure JavaScript, no native binary to compile. Given this machine's history this phase (a filled disk that took down Docker, a Git install that vanished when a drive was merged away), avoiding another native-build dependency was a deliberate, low-regret choice — `bcryptjs` is slower per hash than the C++ version, but at cost factor 12 and creator-account volumes, that difference is irrelevant.

**Why only a length check, no complexity rules:** current guidance (NIST 800-63B, and most production auth systems) favours length over forced complexity — required symbols/digits push people toward predictable substitutions ("Password1!") without meaningfully raising guessing difficulty. Eight characters is a floor, not a target; nothing stops a longer, stronger password.

---

## 9. The pages

| Route | New/changed | Notes |
|---|---|---|
| `/signup` | new | Google button (if configured) → divider → password form → divider is skipped (only one divider needed) → "Already have an account? Log in" |
| `/signin` | rewritten | Now: Google button → password login form → "Forgot password?" → divider → magic-link form → "Don't have an account? Sign up". The heading changed from "Sign in to Formora" to "Log in to Formora" |
| `/verify-account` | new | The signup link's landing page; "Continue" button; success state links to `/signin` |
| `/forgot-password` | new | Single email field; always shows the same "check your email" confirmation |
| `/reset-password` | new | New password + confirm; success state links to `/signin` |
| `/signout` | unchanged | Still just a button calling `signOut()` |

**Why no auto-login after verifying a signup or completing a reset:** both land you back on `/signin` with a success message instead of silently starting a session. This is simpler to implement (no need to bypass Credentials' normal `authorize()` path with a special-case sign-in) and is arguably the more security-conscious default anyway — a credential-changing action ending in an explicit, deliberate login is a well-understood pattern users already expect from other products.

### Scoping three same-page forms with `aria-label`

`/signin` now stacks three separate `<form>` elements, two of which ask for an "Email address" with the same visible label text. Each form carries an `aria-label` (`"Log in with password"`, `"Get a one-time link"`) purely so tests (and screen readers) can disambiguate — `page.getByRole("form", { name: "..." }).getByLabel("Email address")` rather than an ambiguous page-wide `getByLabel` that would match both. This also matches how a screen reader user would want to navigate the page: as two named regions, not one long list of fields.

---

## 10. Nav and homepage changes

### `site-header.tsx`

Removed three links: `/docs`, `/playground` (developer-facing pages for the npm packages — a different audience from form creators, kept live at their URLs, just off the primary nav), and `/dashboard` labelled "Builder" (redundant: it only ever redirected to `/dashboard`, which `AuthNav`'s "My forms" link already covers when signed in).

### `auth-nav.tsx`

Signed-out state changed from a single "Sign in" link to two: "Log in" (`/signin`) and "Sign up" (`/signup`). Signed-in state unchanged ("My forms", "Sign out").

### Homepage (`app/page.tsx`)

**Left the existing content in place.** The homepage, on inspection, turned out to already be the developer marketing page for the npm packages ("Forms as data.", "Try the playground", "Read the docs" — aimed at people integrating the library into their own React app), not a SaaS landing page for end-user form creators. Rather than replace that identity unasked, this phase added one new section between the code snippets and the "How it works" steps: a **"Start from a template"** grid of six placeholder cards (Resume, Portfolio, Invitation, Event RSVP, Job application, Feedback), each marked "Coming soon". The templates themselves are a later phase; this just gives a form-creator visitor something concrete to want. If the homepage's overall identity should change more fundamentally (a full SaaS-style rewrite), that's a separate, larger decision than what this pass covered.

---

## 11. Testing

**Two real bugs found only after deploying, not by the test suite:**

1. **`client_id=undefined` sent to Google.** Auth.js v5's built-in `Google` provider auto-reads `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` by default — not the `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` names this app documents and uses everywhere else. Registering `Google` bare (no options) silently sent the literal string `"undefined"` as the client id, which Google answered with `Error 401: invalid_client`. Fixed by passing `clientId`/`clientSecret` explicitly from the app's own env var names. Found by reading the actual outgoing request URL to `accounts.google.com`, which is safe to inspect since a client id is not a secret.
2. **`OAuthAccountNotLinked`.** By default, Auth.js refuses to attach a new Google sign-in to an existing account with a matching email — a safety default against linking through an unverified provider. Since this account already existed (created earlier via magic link/password with the same address), Google sign-in was rejected outright. Fixed with `allowDangerousEmailAccountLinking: true` on the Google provider — safe here specifically because every account on this app only becomes usable after its email is independently proven (a clicked link, or Google's own pre-verified email), so "same email" already means "same person" everywhere else in this codebase. Neither bug could be caught by the e2e suite, since there is no way to drive a real Google consent screen from Playwright without a live Google account; both were only found by testing the deployed site by hand.

**A real bug this pass's own tests caught before it shipped:** `PasswordLoginForm` originally used plain uncontrolled `<input>` elements inside a server-action `<form>`. React resets a form's uncontrolled fields once its action finishes — so after a failed login attempt, the email field (not just the one the user meant to fix) silently went blank. A user who mistyped their password, then corrected just the password field, would submit an **empty email** on the second try and see the same generic "Incorrect email or password" error again, with no visible reason why. Root-caused by writing a test that mimics exactly this (fail once, fix the password, retry) and watching it fail deterministically even though the underlying signup/verify/reset API was already proven correct via a manual reproduction. Fixed by making both fields controlled (`useState`), so their values survive the action regardless of React's reset behaviour. `SignInForm` (the pre-existing 5b magic-link form) has the same theoretical issue for its one field, but was left as-is — a pre-existing 5b file, out of scope for this pass, and lower severity (only a single field to retype after a validation error).

**Unit tests:** none added — this phase is entirely integration-shaped (routes, cookies, redirects), which e2e tests exercise more faithfully than a unit test could.

**e2e (`apps/web/e2e/password-auth.spec.ts`, 10 new tests):**

| Test | Proves |
|---|---|
| Sign up → verify → log in | The full path works end to end, and the signup link is single-use afterward |
| Wrong password / unverified email | Both fail with the same generic message, before and after signup but without verification |
| Duplicate signup rejected | A second signup attempt for an already-password-protected email gets `409` |
| Magic-link account gains a password | Signing up on an existing magic-link email attaches a password to the *same* account; both methods then work |
| Weak password / mismatched confirm | Rejected server-side (`422`) and client-side ("Passwords don't match"), before any email goes out |
| Expired/reused signup link | `410` for both; a malformed token is `400` before any lookup |
| Forgot password → reset → login | New password works, **old password immediately stops working**, and the reset link itself becomes single-use afterward |
| Forgot-password silence | Same `200` whether the address doesn't exist, is magic-link-only, or genuinely has a password — never distinguishable from the response |
| Google button hidden | Absent from both `/signin` and `/signup` when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` aren't set (true for the e2e server) |
| Accessibility | axe finds no violations on `/signup`, `/forgot-password`, or the signup verification page |

Every test in the file sets a unique `x-forwarded-for` header (via `context.setExtraHTTPHeaders` for browser-driven forms, explicit per-call headers for raw API requests) — without this, every test in the file shared the same "unknown" IP hash and collectively tripped the 20/hour-per-IP cap partway through the suite, causing an unrelated later test to silently receive no email. This is the same lesson 5c's own suite already encoded (`uniqueIp()` per test), applied here too.

**Full regression, run after the JWT-strategy switch specifically:** all 71 pre-existing e2e tests (5a/5b/5c) plus the 10 new ones — **all 95 e2e tests pass**, alongside all 85 unit tests, `tsc --noEmit`, and `eslint`, clean across the whole workspace. In particular, 5b's "a second browser using the same magic link must not get in" test — the one most likely to break silently under a session-storage change — passed without modification.

---

## 12. Production setup checklist

1. Create a Google OAuth client (see section 2) if Google sign-in should be live; skip this and the button simply won't appear.
2. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Vercel's Production environment variables.
3. No other new variables are required — password auth reuses `AUTH_SECRET`, `APP_ORIGIN`, and the existing email-sending configuration.
4. Redeploy (env var changes only apply to new deployments).
5. Verify: sign up with a password on the live site, confirm the verification email arrives (Resend test-sender rules from 5b/5c still apply — only the Resend account's own address receives mail until a domain is verified), log in, then test "Continue with Google" if configured.

---

## 13. Everything Phase 5b-2 deliberately does NOT do yet

- **No account settings page.** There's nowhere to change your email, remove a password, or disconnect Google — those actions can currently only happen through the signup/reset flows themselves.
- **No "verify your current email is still yours" step before a password reset for an OAuth-only account** — moot for now, since Google accounts have no password to reset in the first place, and the forgot-password endpoint already stays silent for them.
- **No rate limiting on the Credentials `authorize()` call itself** — the 5-per-hour limits in this phase all guard *email sending*, not login attempts. A determined attacker can still try many passwords against one account's login form; there's no lockout or backoff on that path yet.
- **No "remember this device" or session-length configuration** — JWT sessions use NextAuth's default expiry.
- **`SignInForm`'s (magic link) uncontrolled-field reset issue is not fixed** — same class of bug as the one found in `PasswordLoginForm`, left alone as an existing 5b file outside this pass's scope.
- **The homepage was not redesigned as a SaaS landing page** — only a placeholder templates section was added; the page's overall identity (developer marketing for the npm packages) is unchanged.
