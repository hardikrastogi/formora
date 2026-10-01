import { describe, it, expect } from "vitest";
import {
  applyCalculatedFields,
  evaluateCalculated,
  evaluateCondition,
  evaluateFormula,
  evaluateVisibility,
  extractFormulaIdentifiers,
} from "../logic-engine";
import type { FormDefinition } from "../schema/form-definition";

function definitionWith(logic: FormDefinition["logic"]): FormDefinition {
  return {
    id: "form_1",
    name: "Test",
    schemaVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    fields: [
      { id: "plan", type: "select", label: "Plan", required: false, defaultProps: { options: ["free", "pro"] } },
      { id: "seats", type: "number", label: "Seats", required: false, defaultProps: {} },
      { id: "price_per_seat", type: "number", label: "Price per seat", required: false, defaultProps: {} },
      { id: "total", type: "number", label: "Total", required: false, defaultProps: {} },
      { id: "discount_code", type: "text", label: "Discount code", required: false, defaultProps: {} },
    ],
    layout: { rows: [] },
    theme: {},
    logic,
  };
}

describe("evaluateCondition", () => {
  it("equals / notEquals compare across types loosely", () => {
    expect(evaluateCondition({ fieldId: "plan", operator: "equals", value: "pro" }, { plan: "pro" })).toBe(true);
    expect(evaluateCondition({ fieldId: "plan", operator: "equals", value: "pro" }, { plan: "free" })).toBe(false);
    expect(evaluateCondition({ fieldId: "seats", operator: "equals", value: 5 }, { seats: "5" })).toBe(true);
    expect(evaluateCondition({ fieldId: "plan", operator: "notEquals", value: "pro" }, { plan: "free" })).toBe(true);
  });

  it("contains is case-insensitive substring matching", () => {
    expect(evaluateCondition({ fieldId: "plan", operator: "contains", value: "RO" }, { plan: "pro-plan" })).toBe(true);
    expect(evaluateCondition({ fieldId: "plan", operator: "contains", value: "zzz" }, { plan: "pro-plan" })).toBe(false);
  });

  it("greaterThan / lessThan compare numerically", () => {
    expect(evaluateCondition({ fieldId: "seats", operator: "greaterThan", value: 3 }, { seats: 5 })).toBe(true);
    expect(evaluateCondition({ fieldId: "seats", operator: "greaterThan", value: 3 }, { seats: 2 })).toBe(false);
    expect(evaluateCondition({ fieldId: "seats", operator: "lessThan", value: 3 }, { seats: 2 })).toBe(true);
  });

  it("isEmpty / isNotEmpty", () => {
    expect(evaluateCondition({ fieldId: "discount_code", operator: "isEmpty" }, {})).toBe(true);
    expect(evaluateCondition({ fieldId: "discount_code", operator: "isEmpty" }, { discount_code: "" })).toBe(true);
    expect(evaluateCondition({ fieldId: "discount_code", operator: "isNotEmpty" }, { discount_code: "SAVE10" })).toBe(
      true,
    );
  });
});

describe("evaluateVisibility", () => {
  it("defaults every field to visible when there are no rules", () => {
    const def = definitionWith({ visibility: [], calculated: [] });
    expect(evaluateVisibility(def, {})).toEqual({
      plan: true,
      seats: true,
      price_per_seat: true,
      total: true,
      discount_code: true,
    });
  });

  it("hides the target field until its condition is met", () => {
    const def = definitionWith({
      visibility: [{ targetFieldId: "seats", match: "all", conditions: [{ fieldId: "plan", operator: "equals", value: "pro" }] }],
      calculated: [],
    });
    expect(evaluateVisibility(def, { plan: "free" }).seats).toBe(false);
    expect(evaluateVisibility(def, { plan: "pro" }).seats).toBe(true);
  });

  it("match 'any' passes if at least one condition is true; 'all' requires every condition", () => {
    const anyDef = definitionWith({
      visibility: [
        {
          targetFieldId: "seats",
          match: "any",
          conditions: [
            { fieldId: "plan", operator: "equals", value: "pro" },
            { fieldId: "discount_code", operator: "isNotEmpty" },
          ],
        },
      ],
      calculated: [],
    });
    expect(evaluateVisibility(anyDef, { plan: "free", discount_code: "X" }).seats).toBe(true);
    expect(evaluateVisibility(anyDef, { plan: "free", discount_code: "" }).seats).toBe(false);

    const allDef = definitionWith({
      visibility: [
        {
          targetFieldId: "seats",
          match: "all",
          conditions: [
            { fieldId: "plan", operator: "equals", value: "pro" },
            { fieldId: "discount_code", operator: "isNotEmpty" },
          ],
        },
      ],
      calculated: [],
    });
    expect(evaluateVisibility(allDef, { plan: "pro", discount_code: "" }).seats).toBe(false);
    expect(evaluateVisibility(allDef, { plan: "pro", discount_code: "X" }).seats).toBe(true);
  });
});

describe("evaluateFormula", () => {
  it("evaluates arithmetic with identifiers from scope", () => {
    expect(evaluateFormula("seats * price_per_seat", { seats: 3, price_per_seat: 10 })).toBe(30);
    expect(evaluateFormula("(a + b) * 2", { a: 1, b: 2 })).toBe(6);
    expect(evaluateFormula("10 - 4 / 2", { })).toBe(8);
    expect(evaluateFormula("-a + 5", { a: 2 })).toBe(3);
  });

  it("returns null for division by zero, unresolved identifiers, or malformed input", () => {
    expect(evaluateFormula("a / b", { a: 1, b: 0 })).toBeNull();
    expect(evaluateFormula("missing + 1", {})).toBeNull();
    expect(evaluateFormula("1 + + 2", {})).toBeNull();
    expect(evaluateFormula("(1 + 2", {})).toBeNull();
    expect(evaluateFormula("1 $ 2", {})).toBeNull();
  });
});

describe("extractFormulaIdentifiers", () => {
  it("lists every distinct identifier, ignoring numbers and operators", () => {
    expect(extractFormulaIdentifiers("seats * price_per_seat + seats")).toEqual(
      expect.arrayContaining(["seats", "price_per_seat"]),
    );
    expect(extractFormulaIdentifiers("seats * price_per_seat")).toHaveLength(2);
  });
});

describe("evaluateCalculated", () => {
  it("computes a simple formula from two inputs", () => {
    const def = definitionWith({
      visibility: [],
      calculated: [{ targetFieldId: "total", inputs: ["seats", "price_per_seat"], formula: "seats * price_per_seat" }],
    });
    expect(evaluateCalculated(def, { seats: 4, price_per_seat: 9 })).toEqual({ total: 36 });
  });

  it("resolves calculated fields chained off each other", () => {
    const def: FormDefinition = {
      ...definitionWith({ visibility: [], calculated: [] }),
      logic: {
        visibility: [],
        calculated: [
          { targetFieldId: "total", inputs: ["seats", "price_per_seat"], formula: "seats * price_per_seat" },
          { targetFieldId: "discount_code", inputs: ["total"], formula: "total / 10" },
        ],
      },
    };
    const result = evaluateCalculated(def, { seats: 2, price_per_seat: 5 });
    expect(result.total).toBe(10);
    expect(result.discount_code).toBe(1);
  });

  it("resolves a cyclic dependency to no value instead of looping forever", () => {
    const def = definitionWith({
      visibility: [],
      calculated: [
        { targetFieldId: "total", inputs: ["price_per_seat"], formula: "price_per_seat + 1" },
        { targetFieldId: "price_per_seat", inputs: ["total"], formula: "total + 1" },
      ],
    });
    const result = evaluateCalculated(def, {});
    expect(result.total).toBeUndefined();
    expect(result.price_per_seat).toBeUndefined();
  });
});

describe("applyCalculatedFields", () => {
  it("overwrites whatever the client submitted for a calculated field", () => {
    const def = definitionWith({
      visibility: [],
      calculated: [{ targetFieldId: "total", inputs: ["seats", "price_per_seat"], formula: "seats * price_per_seat" }],
    });
    const result = applyCalculatedFields(def, { seats: 3, price_per_seat: 10, total: 999999 });
    expect(result.total).toBe(30);
  });

  it("returns the answers unchanged when there are no calculated fields", () => {
    const def = definitionWith({ visibility: [], calculated: [] });
    const answers = { seats: 3 };
    expect(applyCalculatedFields(def, answers)).toBe(answers);
  });
});
