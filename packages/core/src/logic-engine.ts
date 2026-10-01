import type { FormDefinition } from "./schema/form-definition";
import type { Condition, VisibilityRule } from "./schema/logic";

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na === nb;
  return String(a ?? "") === String(b ?? "");
}

export function evaluateCondition(condition: Condition, answers: Record<string, unknown>): boolean {
  const value = answers[condition.fieldId];
  switch (condition.operator) {
    case "equals":
      return looseEquals(value, condition.value);
    case "notEquals":
      return !looseEquals(value, condition.value);
    case "contains":
      return typeof value === "string" && typeof condition.value === "string"
        ? value.toLowerCase().includes(condition.value.toLowerCase())
        : false;
    case "greaterThan": {
      const a = toNumber(value);
      const b = toNumber(condition.value);
      return a !== null && b !== null && a > b;
    }
    case "lessThan": {
      const a = toNumber(value);
      const b = toNumber(condition.value);
      return a !== null && b !== null && a < b;
    }
    case "isEmpty":
      return isBlank(value);
    case "isNotEmpty":
      return !isBlank(value);
    default:
      return true;
  }
}

function evaluateRule(rule: VisibilityRule, answers: Record<string, unknown>): boolean {
  const results = rule.conditions.map((c) => evaluateCondition(c, answers));
  return rule.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

/**
 * Every field defaults to visible. A field with one or more visibility rules
 * is visible only if ALL of its own rules pass — in practice the builder only
 * ever creates one rule per target field, but evaluation stays correct even
 * if a hand-written definition has more than one.
 */
export function evaluateVisibility(
  definition: FormDefinition,
  answers: Record<string, unknown>,
): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};
  for (const field of definition.fields) visibility[field.id] = true;

  const rulesByTarget = new Map<string, VisibilityRule[]>();
  for (const rule of definition.logic.visibility) {
    const list = rulesByTarget.get(rule.targetFieldId) ?? [];
    list.push(rule);
    rulesByTarget.set(rule.targetFieldId, list);
  }
  for (const [targetId, rules] of rulesByTarget) {
    visibility[targetId] = rules.every((rule) => evaluateRule(rule, answers));
  }
  return visibility;
}

// Formula identifiers deliberately exclude '-' (unlike field ids, which may
// contain it) so "a-b" always parses as subtraction, never as one identifier
// named "a-b". Builder-generated field ids only ever use '_' anyway.
const IDENT_START = /[A-Za-z_]/;
const IDENT_CONT = /[A-Za-z0-9_]/;

type Token =
  | { type: "num"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenize(formula: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < formula.length && /[0-9.]/.test(formula[j])) j++;
      const value = Number(formula.slice(i, j));
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: "num", value });
      i = j;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < formula.length && IDENT_CONT.test(formula[j])) j++;
      tokens.push({ type: "ident", value: formula.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    return null; // unknown character — reject rather than silently ignore
  }
  return tokens;
}

/** Every identifier a formula references, in no particular order, deduplicated. */
export function extractFormulaIdentifiers(formula: string): string[] {
  const tokens = tokenize(formula);
  if (!tokens) return [];
  const ids = new Set<string>();
  for (const t of tokens) if (t.type === "ident") ids.add(t.value);
  return [...ids];
}

/**
 * A deliberately tiny, safe arithmetic language: numbers, +-*\/, parentheses,
 * and identifiers resolved from `scope`. No `eval`/`Function` — the formula
 * is authored by the form's creator but runs in the respondent's browser, so
 * arbitrary code execution there would be a real vulnerability, not just a
 * correctness bug. Returns null for anything malformed, an unresolvable
 * identifier, or division by zero, rather than throwing.
 */
export function evaluateFormula(formula: string, scope: Record<string, number>): number | null {
  const tokens = tokenize(formula);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseAtom(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.type === "num") {
      next();
      return t.value;
    }
    if (t.type === "ident") {
      next();
      const v = scope[t.value];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    if (t.type === "op" && t.value === "-") {
      next();
      const v = parseAtom();
      return v === null ? null : -v;
    }
    if (t.type === "lparen") {
      next();
      const v = parseAddSub();
      if (v === null || peek()?.type !== "rparen") return null;
      next();
      return v;
    }
    return null;
  }

  function parseMulDiv(): number | null {
    let left = parseAtom();
    if (left === null) return null;
    while (peek()?.type === "op" && ((peek() as { value: string }).value === "*" || (peek() as { value: string }).value === "/")) {
      const op = (next() as { value: "*" | "/" }).value;
      const right = parseAtom();
      if (right === null) return null;
      if (op === "/") {
        if (right === 0) return null;
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  function parseAddSub(): number | null {
    let left = parseMulDiv();
    if (left === null) return null;
    while (peek()?.type === "op" && ((peek() as { value: string }).value === "+" || (peek() as { value: string }).value === "-")) {
      const op = (next() as { value: "+" | "-" }).value;
      const right = parseMulDiv();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  const result = parseAddSub();
  if (pos !== tokens.length) return null; // leftover tokens: malformed
  return result;
}

/**
 * Resolves every calculated field, including ones chained off each other
 * (a calculated field used as another's input). A field that isn't
 * calculated contributes its own numeric answer to the scope, if it has one.
 * A cycle (A depends on B depends on A) resolves to null for every field
 * in the cycle rather than looping forever.
 */
export function evaluateCalculated(
  definition: FormDefinition,
  answers: Record<string, unknown>,
): Record<string, number> {
  const byTarget = new Map(definition.logic.calculated.map((c) => [c.targetFieldId, c]));
  const results: Record<string, number> = {};
  const resolving = new Set<string>();

  function resolve(id: string): number | null {
    if (id in results) return results[id];
    const calc = byTarget.get(id);
    if (!calc) return toNumber(answers[id]);
    if (resolving.has(id)) return null;
    resolving.add(id);
    const scope: Record<string, number> = {};
    for (const inputId of calc.inputs) {
      const v = resolve(inputId);
      if (v !== null) scope[inputId] = v;
    }
    resolving.delete(id);
    const value = evaluateFormula(calc.formula, scope);
    if (value !== null) results[id] = value;
    return value;
  }

  for (const calc of definition.logic.calculated) resolve(calc.targetFieldId);
  return results;
}

/** Calculated fields always win over whatever the client submitted for them — see validateSubmission's caller. */
export function applyCalculatedFields(
  definition: FormDefinition,
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const calculated = evaluateCalculated(definition, answers);
  if (Object.keys(calculated).length === 0) return answers;
  return { ...answers, ...calculated };
}
