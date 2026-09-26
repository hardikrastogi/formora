import { describe, expect, it } from "vitest";
import type { FormDefinition } from "@hardikrastogi/core";
import { collectServerErrors } from "../server-validation";

const NOW = "2026-01-01T00:00:00.000Z";

function definition(overrides: Partial<FormDefinition> = {}): FormDefinition {
  return {
    id: "form_1",
    name: "Test",
    schemaVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    fields: [],
    layout: { rows: [] },
    theme: {},
    logic: { visibility: [], calculated: [] },
    ...overrides,
  } as FormDefinition;
}

describe("collectServerErrors", () => {
  it("catches core's required/min/max rules, same as validateSubmission alone", () => {
    const def = definition({ fields: [{ id: "name", type: "text", label: "Name", required: true, defaultProps: {} }] });
    const errors = collectServerErrors(def, {});
    expect(errors.name).toEqual(['"Name" is required']);
  });

  it("catches a malformed email even though core's generic rules would accept it", () => {
    const def = definition({ fields: [{ id: "email", type: "email", label: "Email", required: false, defaultProps: {} }] });
    const errors = collectServerErrors(def, { email: "not-an-email" });
    expect(errors.email).toEqual(["Enter a valid email address"]);
  });

  it("accepts a well-formed email", () => {
    const def = definition({ fields: [{ id: "email", type: "email", label: "Email", required: false, defaultProps: {} }] });
    expect(collectServerErrors(def, { email: "ada@example.com" })).toEqual({});
  });

  it("catches a malformed URL", () => {
    const def = definition({ fields: [{ id: "site", type: "url", label: "Site", required: false, defaultProps: {} }] });
    const errors = collectServerErrors(def, { site: "not-a-url" });
    expect(errors.site).toEqual(["Enter a valid URL, starting with http:// or https://"]);
  });

  it("skips the format check for a blank, non-required field", () => {
    const def = definition({ fields: [{ id: "site", type: "url", label: "Site", required: false, defaultProps: {} }] });
    expect(collectServerErrors(def, {})).toEqual({});
  });

  it("does not double-report a field that already failed a core rule", () => {
    const def = definition({
      fields: [{ id: "email", type: "email", label: "Email", required: true, defaultProps: {} }],
    });
    const errors = collectServerErrors(def, {});
    expect(errors.email).toHaveLength(1);
    expect(errors.email).toEqual(['"Email" is required']);
  });

  it("ignores an unregistered custom field type instead of crashing", () => {
    const def = definition({ fields: [{ id: "custom", type: "slider", label: "Custom", required: false, defaultProps: {} }] });
    expect(collectServerErrors(def, { custom: 5 })).toEqual({});
  });
});
