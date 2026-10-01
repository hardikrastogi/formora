# Phase 6 (partial) — Conditional Logic: Deep Reference

A standalone technical reference for the `visibleIf`/calculated-fields slice of Phase 6, in the same style as the other `PHASE_*` files. The `@hardikrastogi/kyc` package (the rest of Phase 6) is a separate, not-yet-built piece of this phase.

Covers: **conditional field visibility** (show/hide a field based on other fields' answers) and **calculated fields** (a number field whose value is derived from other number fields by a formula) — wired into `@hardikrastogi/core`'s schema and validation, `@hardikrastogi/react`'s renderer, `@hardikrastogi/builder`'s Logic tab, and `apps/web`'s submit/update routes.

The schema for both (`Logic`, `VisibilityRule`, `Condition`, `CalculatedField`) has existed since Phase 1 — this is the phase that actually makes it do anything. Before this, the Logic tab was a placeholder and `validateSubmission` ignored `logic` entirely.

---

## 1. The engine: `packages/core/src/logic-engine.ts`

Three independent pieces, all pure functions over a `FormDefinition` and an `answers` object — no React, no server, reusable everywhere:

- **`evaluateCondition`** — one condition against the current answers. Comparisons are deliberately loose (`looseEquals` coerces booleans/numbers/strings sensibly) since an HTML form's values arrive as a mix of types depending on input.
- **`evaluateVisibility`** — every field defaults to visible. A field with one or more `VisibilityRule`s is visible only if **all** of its own rules pass (each rule's own `conditions` combine via its own `match: "all" | "any"`). In practice the builder only ever creates one rule per target field; evaluation stays correct even if a hand-written definition has more.
- **`evaluateFormula`** / **`extractFormulaIdentifiers`** — a small, deliberately non-`eval` arithmetic language: numbers, `+ - * /`, parentheses, and identifiers resolved from a `scope` object. **Why not `eval`/`Function`:** the formula is authored by the form's *creator* but executes in the *respondent's* browser — arbitrary code execution there would be a real vulnerability, not just a correctness bug. Formula identifiers exclude `-` (unlike field ids, which may contain it) so `a-b` always parses as subtraction, never as one identifier named `a-b`; builder-generated field ids only ever use `_` anyway, so this never bites anything made through the UI.
- **`evaluateCalculated`** — resolves every calculated field, including ones chained off each other (a calculated field used as another's input), via recursive resolution with a cycle guard (`resolving` set) — a circular dependency (A depends on B depends on A) resolves to no value for every field in the cycle instead of looping forever.
- **`applyCalculatedFields`** — the one function the server actually calls: overwrites whatever the submitted answers say for a calculated field with the freshly recomputed value.

## 2. Validation is now visibility-aware

`validateSubmission` (core), `collectErrors` (react, client-side resolver), and `collectServerErrors` (react/server, used by `apps/web`'s submit/update routes) all now compute `evaluateVisibility` first and skip every check — required, length, range, format — for a field that's currently hidden. A field hidden by its own condition was never asked; it is never required and a stale value left over from before it was hidden never blocks or pollutes a submission.

Schema referential integrity (`FormDefinitionSchema`'s `superRefine`) was extended to reject: a visibility condition referencing an unknown `fieldId` (previously only the rule's own `targetFieldId` was checked), a calculated field targeting an unknown field, or referencing an unknown field in its `inputs`.

## 3. The renderer: `packages/react/src/use-form-renderer.ts`

- Subscribes to the whole form via `useWatch` so visibility and calculated values stay live as the respondent types, not just re-evaluated on submit.
- `rows` returned from the hook already has hidden columns filtered out (and any row left with zero columns dropped) — `FormRenderer` never has to know visibility exists.
- A `useEffect` writes calculated values into the form itself via `setValue`, guarded so it only fires when the computed value actually differs from what's there — this is what keeps it from looping, since writing a value that matches what `useWatch` already reports is a no-op next pass.
- A calculated field renders `disabled` (reusing the existing prop — no new prop added to the `FieldRendererProps` plugin interface) plus a small "Calculated automatically" caption.
- On submit, hidden fields are stripped from what's actually sent to `onSubmit` — recomputed from the submitted values themselves, the same way the server will independently recompute it.

Because the builder's own live preview (`Builder.tsx`) renders through the real `<FormRenderer>`, this all applies there for free — no separate preview-mode logic needed. The builder's **editing** canvas (`Canvas.tsx`) is a different, field-card-based component that always shows every field regardless of visibility rules, since the creator needs to edit a field even when it would currently be hidden from a respondent.

## 4. The server never trusts the client for a calculated value

`POST /api/forms/[slug]/submit` and `POST /api/forms/[slug]/submission/update` both call `applyCalculatedFields(definition, answers)` before running `collectServerErrors` and before persisting — so a tampered request that posts `{ total: 999999 }` directly to the API has that value silently overwritten with the real, server-recomputed one before it's validated or saved. Verified directly in `e2e/conditional-logic.spec.ts`.

## 5. The builder's Logic tab (`packages/builder/src/Inspector.tsx`)

Two sections, both backed by new store actions (`setVisibilityRule`, `setCalculatedField` — each replaces the *one* rule/formula for a target field, matching the "one rule per field" UX the tab presents, even though the schema itself permits more):

- **Visibility**: a checkbox ("Only show this field conditionally"), disabled with an explanatory message if there's no other field yet to reference. Turning it on creates a default single condition against the first other field. Each condition picks a field (by label, not raw id), an operator, and a value — the value input adapts to the referenced field: a `<select>` of its options if it has any, a Checked/Unchecked `<select>` if it's a checkbox, otherwise plain text. A second+ condition reveals an all/any selector.
- **Calculated** (only shown when the selected field's type is `number`): a checkbox, disabled if there's no other number field. The formula is a plain text input; clicking a chip for another number field inserts its id. Since field ids (`number_1`, `seats`, etc.) aren't shown anywhere else in the builder UI, the chips exist specifically so a creator never has to go hunting for or memorizing an id to write a formula. `inputs` is derived automatically from whichever identifiers in the typed formula actually match a real number field — a formula mid-typed into a momentarily-invalid state (e.g. a partial token) simply doesn't commit to the store yet, rather than ever saving a input list the schema would reject.

`removeField` was extended to also strip the removed field out of every other rule's `conditions`/`inputs` (it already removed rules that *targeted* the removed field), dropping a rule/formula entirely once it has nothing left to evaluate — otherwise deleting a field a condition depended on would leave behind a definition the schema would reject on next publish.

## 6. What this deliberately does not do

- No cross-type calculated fields (string concatenation, date math) — arithmetic only, and only ever targets a `number` field.
- No UI restriction on which operators make sense for which field type (e.g. `contains` on a checkbox) — the engine handles it gracefully (evaluates to `false`), but the builder doesn't hide nonsensical combinations from the creator.
- No per-field "show N rules, ANDed with OR groups" — one rule per field in the builder UI, with `all`/`any` *within* that rule's own conditions. The engine itself supports multiple rules per target (ANDed together) for a hand-written definition, but the UI never produces that shape.
- No cycle *detection with a UI warning* — a cyclic calculated-field dependency silently resolves to no value for the fields involved, rather than the builder refusing to let you create one.

## 7. Tests

- **`packages/core`**: 15 new tests (`logic-engine.test.ts`) covering every condition operator, visibility with no/one/multiple rules and `all`/`any`, formula arithmetic including div-by-zero/malformed/unresolved-identifier failure cases, calculated-field chaining and cycle resolution, and `applyCalculatedFields`. Plus 4 new `form-definition.test.ts` cases for the new referential-integrity checks, and 1 new `validation.test.ts` case proving a hidden field's required check is skipped (and re-enforced once visible).
- **`packages/react`**: 5 new `form-renderer.test.tsx` tests — show/hide live, required-only-when-visible, a stale answer dropped from submission once hidden again, a calculated field computing and staying read-only, and the submitted answer matching the computed value regardless of what was ever typed into that field.
- **`packages/builder`**: 2 new `store.test.ts` tests (cleanup on field removal; the two new actions replace-not-append and clear with `null`) and 3 new `builder.test.tsx` UI-level tests exercising the real Logic tab (default condition on toggle, editing it, calculated formula composition via chips).
- **`apps/web`**: a new `e2e/conditional-logic.spec.ts` (5 tests) covering the full public-form flow (live show/hide, live calculation, required-once-visible), the server recomputing a calculated field against a forged submitted value, the server never requiring a hidden field even when it's missing from the posted answers entirely, and the builder's Logic tab round-tripping through an actual publish.

All 118 unit tests (core 33, react 33, builder 52) and 146 e2e tests pass.
