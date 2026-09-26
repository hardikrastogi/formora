# Phase 5b — Creator Accounts: Deep Reference

A standalone, exhaustive technical reference for Phase 5b. Like `PHASE_5_HOSTED_FORMS.md` (which covers 5a), it is kept separate from `ROADMAP.md` (the plan) and `BUILD_LOG.md` (the running summary). It goes through what exists, file by file, so you can read it without re-deriving anything from the source.

Covers 5b: **sign-in with an emailed link, form ownership, and drafts that autosave to your account.** Verified-email respondents (5c), the response dashboard (5d) and verified-phone (5e) are not built yet.

---

## 1. The big picture

Before 5b, anyone could publish, republish or unpublish any form, and the builder saved your work only in your own browser (localStorage). Phase 5b fixes both:

1. **Who are you?** You sign in with your email. Formora emails you a link; clicking it signs you in. There are no passwords.
2. **What is yours?** The first account to publish a form owns it. Only the owner can republish or unpublish it.
3. **Where is your work?** The builder now saves to your account on the server, so it follows you to any browser.

**One sentence per new concept:**
- **Magic link**: a one-time URL emailed to you. Opening it proves you own that inbox, so it doubles as the password.
- **Session**: after the link is used, the server gives your browser a cookie. Each later request carries the cookie, and the server looks it up to know who you are.
- **Draft**: your work-in-progress copy of a form. It changes constantly and is only ever visible to you.
- **Owner**: the account id stored on a form. Publish and unpublish check it.

**Where 5b sits relative to 5a:** the public side is unchanged. `/f/[slug]` and the submit endpoint still need no account, because respondents are not creators. Only the *authoring* side (publish, unpublish, drafts, dashboard) now requires sign-in.

---

## 2. Environment variables

All secrets live only in `apps/web/.env.local` (gitignored) and in Vercel's Environment Variables. Never in a config file, never with a `NEXT_PUBLIC_` prefix (that prefix would ship the value to every visitor's browser).

| Variable | Purpose | Local value | Production value |
|---|---|---|---|
| `MONGODB_URI` | Database (unchanged from 5a) | `mongodb://127.0.0.1:27017/formora_dev` | Atlas connection string |
| `AUTH_SECRET` | Signs and encrypts Auth.js tokens and cookies. **Must be exactly this name**: a typo (`AUTH_SECRETE`) makes every auth request fail with "Server error: problem with the server configuration". | any long random string | a *different* long random string |
| `AUTH_TRUST_HOST` | Lets Auth.js accept the host header when running `next start` outside Vercel | `true` | not needed (Vercel handles it) |
| `EMAIL_TRANSPORT` | How sign-in emails leave the app: `console` or `resend` | `console` | `resend` |
| `RESEND_API_KEY` | Resend API key (`re_...`) | not needed | your key |
| `EMAIL_FROM` | The "from" address | not needed | `Formora <onboarding@resend.dev>` (Resend's test sender) until you own a domain |

Generate a secret without installing anything:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**Rules that follow from this:**
- Local and production secrets must differ, so a leaked development secret never signs production sessions.
- Keep `apps/web/.env.local` pointing at the local Docker database, so automated tests never touch production data.
- `EMAIL_TRANSPORT=console` must never be set on Vercel. It writes every sign-in link to the server logs and to the database, and anyone who could read those could sign in as anyone.
- Changing a Vercel variable only affects **new** deployments; redeploy after editing.

---

## 3. The sign-in flow, step by step

```
1. Visit /signin (or get redirected there from a protected page, with ?next=<where you were going>)
2. Type your email, press "Email me a sign-in link"
3. Server action requestLink validates the email, then calls Auth.js signIn("email", ...)
4. Auth.js creates a random one-time token in MongoDB (verification_tokens) and calls sendMagicLink(to, url)
5. sendMagicLink either prints the link (console) or POSTs it to Resend (resend)
6. Auth.js redirects the browser to /signin/check-email ("Check your email")
7. You open the email and click the link -> GET /api/auth/callback/email?token=...
8. Auth.js checks the token, deletes it (single use), creates the user if new, creates a session,
   sets the authjs.session-token cookie, and redirects to your `next` path (default /dashboard)
```

- The token works **once** and expires after **15 minutes** (`maxAge: 15 * 60`). A second use of the same link fails; there is an e2e test for this.
- A brand-new email address automatically becomes a new account. There is no separate sign-up page.
- Sessions are **database sessions**: the cookie holds an opaque id, and the real session lives in the `sessions` collection. Signing out deletes it server-side.

**Collections Auth.js creates itself** (via the MongoDB adapter, in the same database as everything else): `users`, `accounts`, `sessions`, `verification_tokens`. Formora's own collections are `forms`, `formversions`, `submissions` (5a) and `drafts` (5b). In local development and e2e runs, `dev_email_outbox` also exists.

---

## 4. The auth files, one by one

### `apps/web/src/lib/db/mongo-client.ts`

```ts
export function getMongoClient(): Promise<MongoClient>
```

Auth.js's MongoDB adapter needs the **native driver** client, not a Mongoose connection. This returns one shared connection promise, cached on `globalThis._mongoClientPromise` so Next.js hot reload in development doesn't open a new connection on every file change (the same trick as `connect.ts` for Mongoose). Throws a clear error if `MONGODB_URI` is unset. The package `mongodb` is pinned to `^6` because `@auth/mongodb-adapter` requires it (version 7 triggers a peer-dependency warning).

### `apps/web/src/lib/auth/send-magic-link.ts`

```ts
export async function sendMagicLink(to: string, url: string): Promise<void>
```

Picks a transport from `EMAIL_TRANSPORT`:

| Value | What happens |
|---|---|
| `console` | Prints `[Formora] Sign-in link for <email>: <url>` to the terminal, and inserts `{to, url, createdAt}` into the `dev_email_outbox` collection (this is how the e2e tests "read the email"). |
| `resend` | `POST https://api.resend.com/emails` with a Bearer token; sends a plain-text and an HTML body. Throws if `RESEND_API_KEY` or `EMAIL_FROM` is missing, or if Resend answers with a non-2xx status. The response body is deliberately **not** logged, because it can echo the address back. |
| unset | Development defaults to `console`. **Production throws**, so a missing setting fails loudly instead of quietly sending nothing or logging links. |

Because the function throws on failure, Auth.js surfaces it as a failed sign-in and the form shows "We couldn't send the sign-in link".

### `apps/web/src/auth.ts`

The Auth.js configuration. It exports `handlers` (the HTTP routes), `auth` (read the current session), `signIn` and `signOut`.

- It is passed as a **function** (`NextAuth(() => ({...}))`), which makes Auth.js build the config lazily, per request. Otherwise `next build` would try to open a MongoDB connection while collecting pages.
- **Adapter:** `MongoDBAdapter(getMongoClient())`.
- **Provider:** a hand-written email provider (`id: "email"`, `type: "email"`) whose `sendVerificationRequest` just calls `sendMagicLink`. Writing it ourselves avoids installing `nodemailer` and lets us use Resend's HTTP API directly.
- **`pages`:** `signIn: "/signin"`, `verifyRequest: "/signin/check-email"` so Auth.js uses our pages instead of its built-in ones.
- **`session` callback:** copies the account id onto `session.user.id`, so route handlers can compare it with `ownerAccountId`.

### `apps/web/src/app/api/auth/[...nextauth]/route.ts`

Two lines: `export const { GET, POST } = handlers;`. This one file serves every `/api/auth/*` URL (csrf, signin, callback, session, signout).

### `apps/web/src/lib/auth/session.ts`

```ts
export async function getUserId(): Promise<string | null>
```

The one helper every protected route and page uses. Returns the signed-in account id, or `null`. There is **no middleware**: each route handler and server page checks for itself. That keeps the logic in one small, testable place, avoids Edge-runtime limits with the database adapter, and, importantly, keeps the docs pages static (a global middleware or a session read in the root layout would force every page to render per request).

### `apps/web/src/lib/safe-redirect.ts`

```ts
export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string
```

After signing in you are sent to the `next` address from the URL. Trusting that blindly is an **open redirect**: an attacker could send `/signin?next=https://evil.example` and, after a genuine login, bounce you to a look-alike site. This function accepts only paths that start with a single `/`, and rejects anything starting with `//` (protocol-relative URL), containing a backslash, or that is not a string. Everything else becomes `/dashboard`. Used in the sign-in page and the sign-in action.

### Sign-in pages (`apps/web/src/app/signin/`)

| File | What it does |
|---|---|
| `page.tsx` | Server component. Reads `?next`, sanitises it, and if you're **already signed in** redirects straight to it. Otherwise renders the heading, a short explanation, and `<SignInForm>`. |
| `sign-in-form.tsx` | Client component using React's `useActionState`. Shows an inline `role="alert"` error, and disables the button ("Sending…") while a request is running so a double click can't send two emails. |
| `actions.ts` | The `requestLink` server action. Trims and lowercases the email, checks it with a simple `x@y.z` pattern (returns "Enter a valid email address." otherwise), then calls `signIn("email", { email, redirectTo: next })`. On success `signIn` redirects by *throwing*, so nothing after it runs. An `AuthError` becomes "We couldn't send the sign-in link…"; any other error is rethrown. |
| `check-email/page.tsx` | Static "Check your email" page. |

### `apps/web/src/app/signout/page.tsx`

A page with a single "Sign out" button that runs a server action calling `signOut({ redirectTo: "/" })`. It is a button (a POST), not a plain link, so a third-party page can't sign you out just by embedding an image.

### `apps/web/src/components/auth-nav.tsx`

The header's right-hand end. It fetches `/api/auth/session` in the browser after the page loads and shows either **Sign in**, or **My forms** and **Sign out**. It renders nothing until the answer arrives (avoids flashing "Sign in" to a signed-in user). Doing this in the browser rather than on the server is what keeps every docs page statically generated.

---

## 5. Ownership: the publish and unpublish routes

### `POST /api/forms/publish`

| Order | Check | Response |
|---|---|---|
| 1 | Signed in? | `401 "Sign in to publish a form."` |
| 2 | Body is JSON? | `400` |
| 3 | `definition` passes `FormDefinitionSchema`? | `422` with the Zod issues |
| 4 | A valid slug can be derived (from an explicit `slug`, else from `definition.id`)? | `422` |
| 5 | Find-or-create the `Form` for that slug, setting `ownerAccountId` to **you** only when it is being created | — |
| 6 | Owned by someone else? | `403 "That link name is already taken."` |
| 7 | Owner is `null` (a form from before accounts)? | You become the owner ("claimed") |
| 8 | Create a new immutable `FormVersion`, mark the form published, point `currentVersionId` at it | `200 { slug, url }` |

The 5a caveat about slug collisions is now enforced instead of merely documented: two creators can no longer overwrite each other. New forms get a random id (`form-xxxxxxxxxx`) that becomes the default slug, so real collisions are extremely unlikely, and a collision is refused rather than silently merged.

### `POST /api/forms/[slug]/unpublish`

- Signed out: `401`.
- The database update matches on **both** slug and owner: `findOneAndUpdate({ slug, ownerAccountId: userId }, ...)`.
- If nothing matches, the answer is `404 "No form found for this slug."` whether the form doesn't exist **or** belongs to someone else. Returning 403 for other people's forms would let anyone discover which slugs exist and are taken; 404 reveals nothing.
- Existing responses and the form itself are untouched. Only new submissions are rejected (the submit route returns 410).

### What did *not* change

`POST /api/forms/[slug]/submit` and `/f/[slug]` remain fully public. Respondents never need an account.

---

## 6. Drafts: saving your work to your account

### `apps/web/src/lib/db/models/Draft.ts`

| Field | Type | Meaning |
|---|---|---|
| `ownerAccountId` | String, required | The account that owns this draft |
| `definitionId` | String, required | The form's id (`definition.id`) |
| `name` | String | Copy of the form name, so the dashboard can list drafts without loading each full definition |
| `definition` | Mixed (any JSON), required | The working `FormDefinition` |
| `createdAt` / `updatedAt` | timestamps | Automatic |

A **unique compound index on `(ownerAccountId, definitionId)`** means: one draft per form per owner, and two creators can each have a draft with the same id without seeing each other's.

`Draft` versus `Form`/`FormVersion`: a draft exists as soon as you start editing and is never public. A `Form` and `FormVersion` only exist once you click Publish.

### `apps/web/src/lib/draft-id.ts`

- `isValidDraftId(id)`: matches `/^[a-z0-9][a-z0-9-]{0,62}$/` (lowercase letters, digits and hyphens, up to 63 characters, must not start with a hyphen). Stops odd strings reaching database queries or URLs.
- `newDraftId()`: `form-` plus 10 random base-36 characters from `crypto.getRandomValues`. This id is *also* the form's default public link name.

### `GET /api/drafts/[id]`

`401` signed out, `404` for an invalid id or a draft that isn't yours (or doesn't exist), else `{ definition }`. Filtering by owner in the query is what makes drafts private: another user's draft is indistinguishable from a missing one.

### `PUT /api/drafts/[id]`

| Check | Response |
|---|---|
| Signed in | `401` |
| Valid id | `400 "Invalid form id."` |
| Body no larger than 1,000,000 characters | `413 "This form is too large to save."` |
| Body is JSON | `400` |
| `definition` is an object whose `id` equals the URL id | `422 "The form's id must match the URL."` |

Then it does an upsert on `(ownerAccountId, definitionId)` setting `definition` and `name` (capped at 200 characters). Returns `{ ok: true }`.

**Why saving is deliberately lenient:** a draft is only ever shown back to its owner, and publishing runs the full `FormDefinitionSchema` check. If saving were strict, a half-edited form (say, a field with an empty label mid-typing) would fail to save and the builder would show "Could not save" for normal editing.

(The size limit counts characters of the text body, which is a close-enough guard against oversized requests, not an exact byte count.)

---

## 7. The pages

| Route | File | Behaviour |
|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | Signed out: redirect to `/signin?next=/dashboard`. Otherwise lists **your** drafts, newest first, each showing its name, last-edited time (in UTC), and either "Live: /f/slug" (published) or "Not published". A "New form" button. Empty state text when you have none. |
| `/builder` | `app/builder/page.tsx` | Just redirects to `/dashboard`, because the builder edits one specific form. |
| `/builder/new` | `app/builder/new/page.tsx` | Signed out: to sign-in. Otherwise redirects to `/builder/<new random id>`. Creates nothing in the database yet. |
| `/builder/[id]` | `app/builder/[id]/page.tsx` | Invalid id: 404. Signed out: to sign-in with `next` set to this page. Otherwise loads your draft (if any) and whether you have this form live, and renders the builder. |

A brand-new form is only written to the database on its **first autosave**, so opening `/builder/new` and leaving without touching anything leaves no empty drafts behind.

### `apps/web/src/app/builder/builder-page.tsx` (client)

Receives `formId`, `initialDefinition` (or `null` for a new form → `createBlankDefinition(formId, "My form")`) and `initialPublished` from the server page, and wires the builder to the API:

- `saveDraft` → `PUT /api/drafts/<id>`
- `publishForm` → `POST /api/forms/publish`
- `unpublishForm` → `POST /api/forms/<slug>/unpublish`

Each throws an `Error` carrying the server's message on a non-2xx response, which the builder shows. This replaces the localStorage stand-in from 5a: `initialPublished` now comes from the **database** (the server page checks whether your form is live), so Unpublish survives a reload without browser storage.

---

## 8. The `@hardikrastogi/builder` change (version 0.4.0)

New optional prop on `<Builder>`:

```ts
onSave?: (definition: FormDefinition) => Promise<void>;
```

`use-autosave.ts` now takes it:

- **Without `onSave`:** exactly as before, debounced save to localStorage.
- **With `onSave`:** after a 500 ms pause in editing, it calls `onSave(definition)`. Resolving shows "Saved"; throwing shows "Could not save".
- **Edits during a save:** if you keep typing while a request is in flight, the definition object changes. The hook notices (`latest.current !== definition`) and does *not* mark the form clean, so the next debounce saves the newer state. Without this, edits made mid-save would be silently marked "Saved" and lost.
- **`onSave` is kept in a ref**, so a host that passes a new inline function every render doesn't restart the debounce timer forever.
- After a failed save, the next edit triggers a fresh attempt automatically (tested).

The package still contains no HTTP or framework code: the host supplies `onSave`, exactly like `onPublish` in 5a.

---

## 9. Testing: what is covered

**Unit (Vitest, `packages/builder`):** 2 new tests, 44 total in the builder package.
- With `onSave`, the edit goes to the host, the indicator returns to "Saved", and **nothing** is written to localStorage.
- When `onSave` rejects, "Could not save" appears, and the next edit saves again with the newer content.

**End-to-end (Playwright, real server, real MongoDB): 71 total.** New file `apps/web/e2e/accounts.spec.ts` (10 tests) plus helpers:

| Test | Proves |
|---|---|
| Signed-out visitors are sent to sign in | `/builder/new` and `/dashboard` are protected |
| Real magic-link flow, and the link is single-use | The emailed link signs you in; a second browser using the same link gets **no** session |
| Invalid email rejected | The server-side check works (browser validation is switched off for this test so the server is what's tested) |
| No off-site redirect | `/signin?next=//evil.example.com` ends on our own `/dashboard` |
| 401s without a session | Publish, unpublish and draft-save all refuse anonymous callers |
| Ownership and privacy | A second account gets 403 on publishing over your slug, 404 on unpublishing it, 404 on reading your draft; the public page still shows *your* version; you can still unpublish and republish |
| Draft id checks | Id in the body must match the URL (422); a bad id is refused (400) |
| Dashboard listing | A saved form appears on the dashboard and reopens from there |
| Save failure is visible | If the save request returns 500, the page shows "Could not save" |
| Accessibility | axe finds no violations on the signed-in builder and dashboard |

`apps/web/e2e/auth-helpers.ts`:
- `signIn(request, email)`: does the real flow through the API (get csrf token, request a link, read it from `dev_email_outbox`, open it, confirm `/api/auth/session` shows that email).
- `openNewBuilder(page)`: signs in as a brand-new unique account and opens `/builder/new`.
- `uniqueEmail(name)`: a random address per test, so parallel tests never share an account.
- `latestLink(email)`: waits for the email to appear in the outbox.

Existing 5a and builder e2e tests were updated to sign in first. `site.spec.ts`'s accessibility list now covers `/signin` instead of `/builder`.

---

## 10. Manual verification (local)

Start the server (`pnpm dev` in `apps/web`), then:

```bash
# Anonymous publish is refused
curl -i -X POST http://localhost:3000/api/forms/publish -H "content-type: application/json" -d "{}"
# -> 401

# Signing in: request a link (the link is printed in the terminal running the server)
# Open http://localhost:3000/signin, enter an email, then copy the link from the terminal.

# See what Auth.js stored (Compass, or mongosh):
docker exec -it formora-mongo mongosh formora_dev --eval "db.users.find().pretty()"
docker exec -it formora-mongo mongosh formora_dev --eval "db.drafts.find({}, {name:1, definitionId:1, ownerAccountId:1})"
docker exec -it formora-mongo mongosh formora_dev --eval "db.forms.find({}, {slug:1, ownerAccountId:1, published:1})"
```

---

## 11. Real problems found by running it

1. **`AUTH_SECRETE` typo.** On the live site every auth URL returned a 500 with "problem with the server configuration". The variable was misspelled in Vercel, so Auth.js saw no secret at all. The fix was renaming it to `AUTH_SECRET` and redeploying.
2. **Auth.js builds links on `localhost`.** Under `next start`, sign-in links use `localhost` whatever address the browser used. The e2e suite originally browsed `127.0.0.1`, so the session cookie (set for `localhost`) never reached the test browser. The suite now uses `localhost`.
3. **A server-action redirect back to the same page did nothing.** The first sign-in form reported errors by redirecting to `/signin?error=...`. It silently failed to update. Rewritten with `useActionState`, the standard pattern.
4. **Files in the wrong folder.** The first sign-in pages were created in `src/signin` instead of `src/app/signin`, so the page 404ed until moved.
5. **Full disk.** The project's turbo build cache had grown large and the drive filled up, making unrelated e2e tests fail with `ENOSPC` (no space left on device). Not a code bug; clearing regenerable caches fixed it.
6. **Wrong tool from `npx`.** `npx auth secret` downloaded an unrelated package (better-auth's CLI) and ran out of disk. A one-line `node` command replaced it.

---

## 12. Production setup checklist

1. Publish `@hardikrastogi/builder` 0.4.0 to npm (the owner's 2FA step).
2. Create a Resend account and an API key with "Sending access".
3. In Vercel → Settings → Environment Variables (Production): `AUTH_SECRET` (fresh random string), `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `EMAIL_FROM`. `MONGODB_URI` is already there.
4. Redeploy (variables only apply to new deployments).
5. Sign in on the live site with the address you registered with Resend (the test sender only delivers to that address).
6. Later, for anyone to sign in: verify a domain in Resend (SPF/DKIM DNS records) and set `EMAIL_FROM` to an address on it.

---

## 13. Everything Phase 5b deliberately does NOT do yet

- **Anyone but you can't sign in on the live site** until a domain is verified with Resend. The test sender delivers only to the address that owns the Resend account.
- **No "Continue with Google".** Deferred on purpose; magic link only for now.
- **No rate limiting on sign-in requests.** Someone could spam the button and use up the free email allowance (about 100 a day). Worth adding before sharing the site widely.
- **No account or draft deletion**, and no account settings page.
- **Forms from before accounts** (the old demo slugs) can be claimed by the first signed-in person to publish them. Harmless while all such data is your own demo data.
- **No response viewing yet.** Owner-only access is designed in, but the response dashboard is Phase 5d.
- **No builder UI for close date, max responses or one-response-per-person.** The fields exist on `Form` (from 5a) but nothing sets them.
- **Deleting a form does not exist**, only Unpublish.
- **Respondent verification** (verified email/phone) is Phase 5c/5e, a separate system from creator sign-in.
