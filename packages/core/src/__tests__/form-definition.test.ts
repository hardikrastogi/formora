import { describe, it, expect } from "vitest";
import { z } from "zod";
import { FormDefinitionSchema } from "../schema/form-definition";

function baseDefinition(): z.input<typeof FormDefinitionSchema> {
  return {
    id: "form_1",
    name: "Contact Form",
    schemaVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    fields: [
      { id: "name", type: "text", label: "Name", required: true },
      { id: "email", type: "email", label: "Email", required: true },
    ],
    layout: {
      rows: [
        {
          id: "row_1",
          columns: [
            { span: 6, fieldId: "name" },
            { span: 6, fieldId: "email" },
          ],
        },
      ],
    },
    theme: {},
    logic: { visibility: [], calculated: [] },
  };
}

describe("FormDefinitionSchema", () => {
  it("accepts a valid definition and applies field defaults", () => {
    const result = FormDefinitionSchema.safeParse(baseDefinition());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fields[0].defaultProps).toEqual({});
    }
  });

  it("accepts a per-field style override and rejects an invalid radius", () => {
    const ok = baseDefinition();
    ok.fields[0].style = { textColor: "#111111", radius: "lg" };
    expect(FormDefinitionSchema.safeParse(ok).success).toBe(true);

    const bad = baseDefinition();
    bad.fields[0].style = { radius: "huge" as never };
    expect(FormDefinitionSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unsafe field ids", () => {
    for (const badId of ["a.b", "1abc", "__proto__", "has space", ""]) {
      const def = baseDefinition();
      def.fields[0].id = badId;
      expect(FormDefinitionSchema.safeParse(def).success).toBe(false);
    }
  });

  it("rejects duplicate field ids", () => {
    const def = baseDefinition();
    def.fields.push({ id: "name", type: "text", label: "Name Again" });
    const result = FormDefinitionSchema.safeParse(def);
    expect(result.success).toBe(false);
  });

  it("rejects a layout row whose columns exceed 12 spans", () => {
    const def = baseDefinition();
    def.layout!.rows![0].columns.push({ span: 8, fieldId: "email" });
    const result = FormDefinitionSchema.safeParse(def);
    expect(result.success).toBe(false);
  });

  it("rejects a layout referencing an unknown fieldId", () => {
    const def = baseDefinition();
    def.layout!.rows![0].columns[0].fieldId = "does_not_exist";
    const result = FormDefinitionSchema.safeParse(def);
    expect(result.success).toBe(false);
  });

  it("rejects a visibility rule targeting an unknown fieldId", () => {
    const def = baseDefinition();
    def.logic!.visibility!.push({
      targetFieldId: "ghost_field",
      match: "all",
      conditions: [{ fieldId: "name", operator: "isNotEmpty" }],
    });
    const result = FormDefinitionSchema.safeParse(def);
    expect(result.success).toBe(false);
  });
});
