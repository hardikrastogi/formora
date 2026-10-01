import { describe, it, expect } from "vitest";
import { validateSubmission } from "../validation";
import type { FormDefinition } from "../schema/form-definition";

const definition: FormDefinition = {
  id: "form_1",
  name: "Signup",
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  fields: [
    { id: "username", type: "text", label: "Username", required: true, defaultProps: {}, validation: { minLength: 3, maxLength: 20 } },
    { id: "age", type: "number", label: "Age", required: false, defaultProps: {}, validation: { min: 18, max: 120 } },
  ],
  layout: { rows: [] },
  theme: {},
  logic: { visibility: [], calculated: [] },
};

describe("validateSubmission", () => {
  it("passes when all answers satisfy the rules", () => {
    const result = validateSubmission(definition, { username: "hardik", age: 25 });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("fails when a required field is missing", () => {
    const result = validateSubmission(definition, { age: 25 });
    expect(result.success).toBe(false);
    expect(result.errors.username).toBeDefined();
  });

  it("fails when a string is shorter than minLength", () => {
    const result = validateSubmission(definition, { username: "ab" });
    expect(result.success).toBe(false);
    expect(result.errors.username[0]).toMatch(/at least 3/);
  });

  it("fails when a number is out of range", () => {
    const result = validateSubmission(definition, { username: "hardik", age: 10 });
    expect(result.success).toBe(false);
    expect(result.errors.age[0]).toMatch(/at least 18/);
  });

  it("treats an unticked required checkbox and an empty required list as missing", () => {
    const def: FormDefinition = {
      ...definition,
      fields: [
        { id: "agree", type: "checkbox", label: "Agree", required: true, defaultProps: {} },
        { id: "tags", type: "multiselect", label: "Tags", required: true, defaultProps: {} },
      ],
    };
    const result = validateSubmission(def, { agree: false, tags: [] });
    expect(result.success).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(["agree", "tags"]);
    expect(validateSubmission(def, { agree: true, tags: ["a"] }).success).toBe(true);
  });

  it("allows an optional field to be omitted", () => {
    const result = validateSubmission(definition, { username: "hardik" });
    expect(result.success).toBe(true);
  });

  it("skips required/format checks entirely for a field hidden by its own visibility rule", () => {
    const def: FormDefinition = {
      ...definition,
      fields: [
        { id: "has_company", type: "checkbox", label: "Do you have a company?", required: false, defaultProps: {} },
        { id: "company_name", type: "text", label: "Company name", required: true, defaultProps: {} },
      ],
      logic: {
        visibility: [
          {
            targetFieldId: "company_name",
            match: "all",
            conditions: [{ fieldId: "has_company", operator: "equals", value: true }],
          },
        ],
        calculated: [],
      },
    };
    // Hidden (has_company is false) — the otherwise-required company_name is not enforced.
    expect(validateSubmission(def, { has_company: false }).success).toBe(true);
    // Visible (has_company is true) — now it's actually required again.
    const shown = validateSubmission(def, { has_company: true });
    expect(shown.success).toBe(false);
    expect(shown.errors.company_name).toBeDefined();
    expect(validateSubmission(def, { has_company: true, company_name: "Acme" }).success).toBe(true);
  });
});
