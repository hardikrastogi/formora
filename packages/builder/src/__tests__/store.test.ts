import { describe, expect, it } from "vitest";
import { createBlankDefinition } from "../blank";
import { fieldMetaFor } from "../field-catalog";
import { createBuilderStore } from "../store";

function freshStore() {
  return createBuilderStore(createBlankDefinition("f1", "Test form"));
}

const text = fieldMetaFor("text")!;
const email = fieldMetaFor("email")!;

describe("builder store", () => {
  it("adding a field creates it and a full-width layout row for it", () => {
    const store = freshStore();
    const id = store.getState().addField(text);
    const state = store.getState();
    expect(state.definition.fields).toHaveLength(1);
    expect(state.definition.fields[0]).toMatchObject({ id, type: "text", required: false });
    expect(state.definition.layout.rows).toHaveLength(1);
    expect(state.definition.layout.rows[0].columns).toEqual([{ span: 12, fieldId: id }]);
    expect(state.selectedFieldId).toBe(id);
  });

  it("gives fields unique, incrementing ids per type", () => {
    const store = freshStore();
    const a = store.getState().addField(text);
    const b = store.getState().addField(text);
    expect(a).not.toBe(b);
    expect(a).toBe("text_1");
    expect(b).toBe("text_2");
  });

  it("removing a field also removes it from layout and any visibility rules that targeted it", () => {
    const store = freshStore();
    const id = store.getState().addField(text);
    store.setState((s) => ({
      definition: { ...s.definition, logic: { visibility: [{ targetFieldId: id, match: "all", conditions: [] }], calculated: [] } },
    }));
    store.getState().removeField(id);
    const state = store.getState();
    expect(state.definition.fields).toHaveLength(0);
    expect(state.definition.layout.rows).toHaveLength(0);
    expect(state.definition.logic.visibility).toHaveLength(0);
    expect(state.selectedFieldId).toBeNull();
  });

  it("removing a field also strips it out of other fields' conditions and calculated inputs", () => {
    const store = freshStore();
    const dependency = store.getState().addField(text);
    const target = store.getState().addField(text);
    const calcTarget = store.getState().addField(text);
    store.getState().setVisibilityRule(target, {
      targetFieldId: target,
      match: "all",
      conditions: [{ fieldId: dependency, operator: "isNotEmpty" }],
    });
    store.getState().setCalculatedField(calcTarget, {
      targetFieldId: calcTarget,
      inputs: [dependency],
      formula: dependency,
    });

    store.getState().removeField(dependency);
    const state = store.getState();
    // The rule/formula referencing the removed field as their only
    // condition/input has nothing left to evaluate, so it's dropped entirely.
    expect(state.definition.logic.visibility).toHaveLength(0);
    expect(state.definition.logic.calculated).toHaveLength(0);
  });

  it("updateField patches only the given field", () => {
    const store = freshStore();
    const a = store.getState().addField(text);
    const b = store.getState().addField(email);
    store.getState().updateField(a, { label: "Full name", required: true });
    const fields = store.getState().definition.fields;
    expect(fields.find((f) => f.id === a)).toMatchObject({ label: "Full name", required: true });
    expect(fields.find((f) => f.id === b)).toMatchObject({ label: "Email" });
  });

  it("reorderFields moves a row to sit where another row was", () => {
    const store = freshStore();
    const a = store.getState().addField(text);
    const b = store.getState().addField(email);
    const c = store.getState().addField(text);
    store.getState().reorderFields(c, a);
    const order = store.getState().definition.layout.rows.flatMap((r) => r.columns.map((col) => col.fieldId));
    expect(order).toEqual([c, a, b]);
  });

  it("setFieldSpan clamps to the 1-12 range", () => {
    const store = freshStore();
    const id = store.getState().addField(text);
    store.getState().setFieldSpan(id, 20);
    expect(store.getState().definition.layout.rows[0].columns[0].span).toBe(12);
    store.getState().setFieldSpan(id, 0);
    expect(store.getState().definition.layout.rows[0].columns[0].span).toBe(1);
  });

  it("undo reverts the last change and redo replays it", () => {
    const store = freshStore();
    const id = store.getState().addField(text);
    store.getState().updateField(id, { label: "Changed" });
    expect(store.getState().definition.fields[0].label).toBe("Changed");

    store.getState().undo();
    expect(store.getState().definition.fields[0].label).toBe("Text field");

    store.getState().redo();
    expect(store.getState().definition.fields[0].label).toBe("Changed");
  });

  it("undo past the beginning is a no-op, and a new edit clears redo history", () => {
    const store = freshStore();
    const id = store.getState().addField(text);
    store.getState().undo();
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().definition.fields).toHaveLength(0);

    const secondId = store.getState().addField(email);
    store.getState().updateField(secondId, { label: "X" });
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);
    store.getState().addField(text);
    expect(store.getState().future).toHaveLength(0);
    void id;
  });

  it("tracks dirty state and clears it on markSaved", () => {
    const store = freshStore();
    expect(store.getState().isDirty).toBe(false);
    store.getState().addField(text);
    expect(store.getState().isDirty).toBe(true);
    store.getState().markSaved();
    expect(store.getState().isDirty).toBe(false);
  });

  it("setVisibilityRule replaces the one rule for a target field, and clears it with null", () => {
    const store = freshStore();
    const a = store.getState().addField(text);
    const b = store.getState().addField(email);
    store.getState().setVisibilityRule(b, { targetFieldId: b, match: "all", conditions: [{ fieldId: a, operator: "isNotEmpty" }] });
    expect(store.getState().definition.logic.visibility).toHaveLength(1);

    store.getState().setVisibilityRule(b, { targetFieldId: b, match: "any", conditions: [{ fieldId: a, operator: "isEmpty" }] });
    const rules = store.getState().definition.logic.visibility;
    expect(rules).toHaveLength(1);
    expect(rules[0].match).toBe("any");

    store.getState().setVisibilityRule(b, null);
    expect(store.getState().definition.logic.visibility).toHaveLength(0);
  });

  it("setCalculatedField replaces the one formula for a target field, and clears it with null", () => {
    const store = freshStore();
    const a = store.getState().addField(text);
    const b = store.getState().addField(email);
    store.getState().setCalculatedField(b, { targetFieldId: b, inputs: [a], formula: a });
    expect(store.getState().definition.logic.calculated).toHaveLength(1);

    store.getState().setCalculatedField(b, { targetFieldId: b, inputs: [a], formula: `${a} + 1` });
    const calc = store.getState().definition.logic.calculated;
    expect(calc).toHaveLength(1);
    expect(calc[0].formula).toBe(`${a} + 1`);

    store.getState().setCalculatedField(b, null);
    expect(store.getState().definition.logic.calculated).toHaveLength(0);
  });

  it("setTheme merges rather than replaces the theme object", () => {
    const store = freshStore();
    store.getState().setTheme({ colors: { primary: "#ff0000" } });
    store.getState().setTheme({ radius: "lg" });
    expect(store.getState().definition.theme).toMatchObject({ colors: { primary: "#ff0000" }, radius: "lg" });
  });

  it("loadDefinition replaces state and resets history and selection", () => {
    const store = freshStore();
    store.getState().addField(text);
    store.getState().select("text_1");
    const other = createBlankDefinition("f2", "Other");
    store.getState().loadDefinition(other);
    expect(store.getState().definition).toBe(other);
    expect(store.getState().selectedFieldId).toBeNull();
    expect(store.getState().past).toHaveLength(0);
  });
});
