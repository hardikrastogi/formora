# Phase 5b-3 — Manual Save, Local Crash Recovery: Deep Reference

A standalone, exhaustive technical reference for this change, in the same style as the other `PHASE_*` files. This one **reverses part of what 5b shipped**, on purpose, after review — see section 1 for why. Read alongside `PHASE_5B_CREATOR_ACCOUNTS.md`, whose sections 6–8 describe the mechanics (the `Draft` model, the API routes, the pages) that mostly still hold; only *when* a save happens changed, not the routes or model shape.

---

## 1. What changed, and why

**Before this change (5b's original design):** every edit in the builder was silently sent to the database, 500ms after you stopped typing. No button, no confirmation needed — it just happened continuously in the background.

**After this change:** saving to the database is a deliberate action. A **Save** button appears in the builder; nothing reaches the database until it's clicked. Unsaved work is instead backed up to the browser's own `localStorage`, so closing the tab, refreshing, or a crash doesn't lose it — but it stays local to that one browser until Save is actually clicked.

**Why the reversal:** the original design was Claude's engineering decision during 5b, not something explicitly requested. When the person building Formora questioned it directly — concerned that continuous per-user database writes could become expensive or risky at scale — the honest technical answer was that the literal risk was smaller than feared (a debounced, per-user write is a light workload; this is roughly the pattern Google Docs, Notion, and Figma use, and MongoDB Atlas handles it without strain even at thousands of concurrent editors). But smaller risk doesn't mean the automatic design was the *right* one. Manual save is simpler to reason about, gives the creator explicit control over what "saved" means, and removes an entire class of "what if I close the tab mid-save" and "what if I keep editing while a request is in flight" edge cases the old debounce hook had to handle carefully (see `PHASE_5B_CREATOR_ACCOUNTS.md`'s description of the old hook's `latest.current !== definition` check — that entire problem no longer exists, because saving now only ever happens once, on a deliberate click, never while further edits are landing mid-request).

**The exact recovery rule, decided explicitly:**
- Closing the tab, refreshing, or the browser crashing: unsaved work is recovered, for as long as that browser keeps the data. No code-based expiry — it lives in `localStorage` until the browser itself clears it (private browsing, manually clearing site data, a browser reinstall) or the person switches to a different browser/device.
- A different browser, a different device, or local storage having been cleared: only whatever was last explicitly **Saved** (or Published) is available. There is no way to recover further than that — this was a deliberate, informed choice, not an oversight.

---

## 2. The three layers, and which one "wins"

There are now three places a form's content can live, each with a different lifetime:

| Layer | Lives in | Survives | Who sees it |
|---|---|---|---|
| **Editor state** | React/Zustand, in memory | Nothing — gone on refresh | Only the current tab, right now |
| **Local backup** | `localStorage`, this browser | Refresh, tab close, browser restart | Only this one browser |
| **Saved draft** | MongoDB `drafts` collection | Everything — it's the account's own data | Any browser, once signed in |

Opening the builder decides which of the latter two to start from: **the local backup wins if one exists**, even over what was last explicitly saved. This is deliberate — a local backup represents work more recent than the last Save (otherwise it wouldn't still be sitting there unsaved), so it should always take priority in the same browser. Reopening on a *different* browser has no local backup to prefer, so it falls back to the last saved draft, exactly as before.

---

## 3. The builder package (`@hardikrastogi/builder`, bumped 0.4.0 → 0.5.0)

### `onSave`'s meaning changed

```ts
onSave?: (definition: FormDefinition) => Promise<void>;
```

The prop itself didn't move, but **when it's called did**. Before: called automatically, debounced, on every edit. Now: called **only** when the person clicks the builder's own **Save** button. This is a breaking behavioural change for anyone consuming the package directly, hence the minor version bump (acceptable within 0.x). A host that provides `onSave` now also gets a Save button rendered automatically — there was no way to opt out of the old automatic behaviour before, and there's no way to opt out of the button now; if you provide `onSave`, saving is manual.

A host that provides **no** `onSave` at all keeps the exact old behaviour: fully automatic saving to `localStorage`, with no Save button, useful for a standalone/demo builder with no backend of its own. This is unaffected by this change — see `useAutosaveWithoutHost` below.

### Two hooks replace the old single `useAutosave` (`use-autosave.ts`)

**`useLocalBackup(storageKey, definition, isDirty)`** — always runs, regardless of whether `onSave` is provided. A 400ms debounce writes the current definition to `localStorage`. It never calls anything the host provided, never fails loudly (a full or disabled `localStorage` just means no crash recovery for that session, not a broken editor), and drives no visible indicator by itself — it's invisible plumbing.

**`useAutosaveWithoutHost(storageKey, definition, isDirty, markSaved)`** — the old hook's behaviour, preserved verbatim, but only used when there's no `onSave`. In that case `localStorage` *is* the save, so this one still drives the "Saving…"/"Saved" indicator and calls `markSaved()`.

`BuilderInner` calls both hooks unconditionally (rules of hooks don't allow calling a hook conditionally), but gates each one's actual effect by passing `isDirty && condition` — only one of the two ever does anything on a given render, decided by whether `onSave` exists:

```ts
useLocalBackup(storageKey, definition, isDirty && Boolean(onSave));
const autoSaveState = useAutosaveWithoutHost(storageKey, definition, isDirty && !onSave, markSaved);
```

### The manual save handler and the new indicator state

```ts
const [manualSaveState, setManualSaveState] = useState<"idle" | "saving" | "error">("idle");
async function handleSave() {
  if (!onSave) return;
  setManualSaveState("saving");
  try {
    await onSave(definition);
    markSaved();
    setManualSaveState("idle");
  } catch {
    setManualSaveState("error");
  }
}
```

The status text needs a fourth state beyond the old three (`"saved" | "saving" | "error"`): **`"dirty"`** — "there are edits since the last successful save," shown as **"Unsaved changes."** This only applies in `onSave` mode:

```ts
const indicatorState: IndicatorState = !onSave
  ? autoSaveState
  : manualSaveState !== "idle"
    ? manualSaveState
    : isDirty
      ? "dirty"
      : "saved";
```

Order matters: an in-flight save or a past error takes priority over the dirty check, so "Could not save" stays visible (a deliberate reminder to retry) even if you keep editing afterward — it only clears on the next Save attempt, success or failure.

### `TopBar.tsx`

A new `onSave?: () => void` prop. When present, a **Save** button renders (disabled while `saveState === "saving"`, showing "Saving…"), immediately to the left of Publish. The status text alongside it now also handles `"dirty"` → **"Unsaved changes."**

### `context.tsx` / `BuilderProvider`: preferring the local backup on mount

```tsx
export function BuilderProvider({ initialDefinition, storageKey, children }: {
  initialDefinition: FormDefinition;
  storageKey: string;
  children: ReactNode;
}) {
  const storeRef = useRef<Store | null>(null);
  if (!storeRef.current) {
    const restored = loadFromStorage(storageKey);
    storeRef.current = createBuilderStore(restored ?? initialDefinition, Boolean(restored));
  }
  ...
}
```

`storageKey` became a **required** prop on `BuilderProvider` (previously it didn't take one at all — only `BuilderInner` knew about it). This is also a breaking change for any direct consumer of `BuilderProvider` (rather than the top-level `<Builder>`, which computes and threads the key through automatically and is unaffected).

**The `startDirty` parameter on `createBuilderStore`** is the detail that makes recovery honest: a store hydrated from a local backup starts with `isDirty: true`, not `false`. Without this, reopening a browser with unsaved work would show "Saved" even though nothing had actually reached the server — a false assurance. A small test (`"remounting with onSave resumes from the local backup..."`) caught exactly this the first time it was implemented, before the `startDirty` parameter existed.

---

## 4. The web app: what changed, and what didn't

**What changed:**
- `apps/web/src/app/builder/builder-page.tsx`: the explanatory paragraph above the builder canvas was rewritten (it used to say saves happen "automatically").
- `apps/web/src/app/dashboard/page.tsx`: rewritten — see section 5.

**What didn't change at all:** the `saveDraft` function passed as `onSave`, and the `PUT /api/drafts/[id]` route it calls, are byte-for-byte the same as 5b shipped them. The route has no idea whether it's being called automatically or manually — that distinction lives entirely inside the builder package. This is why the blast radius of this change was small: one package, one dashboard query, one paragraph of copy.

---

## 5. The dashboard bug this change would have introduced, and its fix

5b's dashboard listed forms by first finding your **drafts**, then filtering `Form` documents down to ones with a matching draft slug. That was fine when *every* form-in-progress always had a continuously-updated draft (the old automatic behaviour guaranteed this). Under manual save, it stops being true: a creator could type a form, click **Publish** directly, and never click **Save** at all. Publish doesn't depend on a saved draft — it sends whatever's currently in the editor straight to `POST /api/forms/publish`. Under the old dashboard query, that published, live form would be **invisible on the dashboard**, because no draft record for it would exist.

The fix (in the same commit as the manual-save change, not a separate patch): the dashboard now fetches **all** of your `Draft`s and **all** of your `Form`s independently, and merges them by slug:

```ts
const drafts = await DraftModel.find({ ownerAccountId: userId }).lean();
const forms = await FormModel.find({ ownerAccountId: userId }).lean();
// merge by slug; a form with no matching draft still needs a name to show —
// fetched from its current FormVersion's definition.name, batched in one query
```

A form that has never been saved as a draft (published directly) now shows up using the name baked into its published `FormVersion`, fetched in a single batched query (`FormVersionModel.find({ _id: { $in: [...] } })`) rather than one query per form. A form that *does* have a matching draft still prefers the draft's own `name` and `updatedAt`, since that reflects the more recent, editor-visible state.

---

## 6. Testing

**Package (`@hardikrastogi/builder`), 5 changed/new tests, 46 total:**

| Test | Proves |
|---|---|
| "with onSave, editing shows 'Unsaved changes' and never calls the host until Save is clicked" | The core behaviour change: no network call happens from typing alone |
| "shows 'Could not save' when the host's onSave rejects, and Save can be retried" | A failed manual save is visible, and clicking Save again retries it |
| "still backs up to localStorage in the background even when onSave is provided, for crash recovery only" | The local backup runs even in manual-save mode, and never itself calls the host |
| "remounting with onSave resumes from the local backup, not the (older) definition the host passed in" | Reopening the same browser recovers unsaved edits, correctly marked dirty (this is the test that caught the `startDirty` gap) |
| "autosaves the definition to localStorage after an edit" (pre-existing, unchanged) | The no-`onSave` fallback mode is completely untouched by this change |

**App (`apps/web`), 3 e2e tests rewritten, all still passing:**

- `accounts.spec.ts`: "a new form appears on the dashboard once saved" now clicks Save explicitly before checking the dashboard; a new "save failures are shown, not swallowed, and Save can be retried" test replaces the old passive-autosave-failure test.
- `builder.spec.ts`: "unsaved work survives a reload via the browser's own local storage, without ever hitting the server" replaces the old "autosave saves to the server" test — it now explicitly asserts **no** request to `/api/drafts/` happens, and that the recovered content still shows "Unsaved changes" (not a false "Saved").
- `form-expiry.spec.ts`: the builder-UI close-date test no longer waits for an automatic draft save before publishing, since Publish never depended on one.

**A genuine race condition found while writing these tests, twice:** the local backup is debounced by 400ms. Both the crash-recovery e2e test and an earlier attempt at the "Clear and republish" test in `form-expiry.spec.ts` initially reloaded/proceeded immediately after an edit, before the debounced write (or the debounced request, in the earlier case) had actually completed — a real race, not a flaky test, since a reload genuinely can outrun a pending `setTimeout`. Fixed by explicitly waiting for the actual side effect (`page.waitForFunction` polling `localStorage`, or `page.waitForResponse` for the network call) rather than trusting that a UI text change implies the underlying write already landed.

**Full regression after this change:** all 100 e2e tests and all 87 unit tests pass; `tsc --noEmit` and `eslint` are clean across the whole workspace.

---

## 7. Everything this change deliberately does NOT do

- **No code-based expiry on the local backup.** It is kept exactly as long as the browser keeps it — this was asked for explicitly, not an oversight or a missing "nice to have."
- **No "discard my unsaved local changes and go back to the last saved version" button.** If a local backup exists, it always wins over the server's last-saved copy; there's currently no way to intentionally reject it in the UI.
- **No warning before navigating away with unsaved changes** (no `beforeunload` confirmation dialog). Not requested, and arguably less necessary now that local recovery exists.
- **No indication on the dashboard of *which* forms have unsaved local changes sitting in the current browser** — the dashboard reflects only what's in the database (drafts and forms), never what's sitting unsaved in `localStorage`.
- **The published npm package's breaking change (`onSave` now manual, `BuilderProvider` requires `storageKey`) has not yet been published to npm** — that still needs the maintainer's own `npm publish` step (2FA), same as every previous version bump.
