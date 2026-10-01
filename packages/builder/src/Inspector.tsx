import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useState, type ChangeEvent } from "react";
import { extractFormulaIdentifiers, type Condition, type FieldConfig, type VisibilityRule } from "@hardikrastogi/core";
import { useBuilder } from "./context";
import { contrastAgainstWhite, WCAG_AA_NORMAL_TEXT } from "./contrast";

function fieldSpan(rows: { columns: { fieldId: string; span: number }[] }[], fieldId: string): number {
  for (const row of rows) {
    const col = row.columns.find((c) => c.fieldId === fieldId);
    if (col) return col.span;
  }
  return 12;
}

function optionsToText(options: unknown): string {
  if (!Array.isArray(options)) return "";
  return options
    .map((o) => (typeof o === "string" ? o : typeof o === "object" && o && "label" in o ? String((o as { label: unknown }).label) : ""))
    .filter(Boolean)
    .join("\n");
}

function BasicTab() {
  const definition = useBuilder((s) => s.definition);
  const selectedFieldId = useBuilder((s) => s.selectedFieldId)!;
  const updateField = useBuilder((s) => s.updateField);
  const field = definition.fields.find((f) => f.id === selectedFieldId)!;
  const hasOptions = ["select", "radio", "country", "currency"].includes(field.type);
  const hasPlaceholder = !["checkbox", "rating"].includes(field.type);

  return (
    <div className="fb-inspector-tab">
      <label className="fb-field">
        <span>Label</span>
        <input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} />
      </label>
      <label className="fb-field">
        <span>Description</span>
        <input
          value={field.description ?? ""}
          onChange={(e) => updateField(field.id, { description: e.target.value || undefined })}
        />
      </label>
      <label className="fb-field fb-field-checkbox">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => updateField(field.id, { required: e.target.checked })}
        />
        <span>Required</span>
      </label>
      {hasPlaceholder && (
        <label className="fb-field">
          <span>Placeholder</span>
          <input
            value={typeof field.defaultProps.placeholder === "string" ? field.defaultProps.placeholder : ""}
            onChange={(e) =>
              updateField(field.id, { defaultProps: { ...field.defaultProps, placeholder: e.target.value } })
            }
          />
        </label>
      )}
      {hasOptions && (
        <label className="fb-field">
          <span>Options (one per line)</span>
          <textarea
            rows={4}
            value={optionsToText(field.defaultProps.options)}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              const options = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
              updateField(field.id, { defaultProps: { ...field.defaultProps, options } });
            }}
          />
        </label>
      )}
    </div>
  );
}

function ValidationTab() {
  const definition = useBuilder((s) => s.definition);
  const selectedFieldId = useBuilder((s) => s.selectedFieldId)!;
  const updateField = useBuilder((s) => s.updateField);
  const field = definition.fields.find((f) => f.id === selectedFieldId)!;
  const validation = field.validation ?? {};
  const isNumber = field.type === "number";
  const set = (patch: typeof validation) => updateField(field.id, { validation: { ...validation, ...patch } });
  const num = (v: string) => (v === "" ? undefined : Number(v));

  return (
    <div className="fb-inspector-tab">
      {isNumber ? (
        <>
          <label className="fb-field">
            <span>Minimum value</span>
            <input type="number" value={validation.min ?? ""} onChange={(e) => set({ min: num(e.target.value) })} />
          </label>
          <label className="fb-field">
            <span>Maximum value</span>
            <input type="number" value={validation.max ?? ""} onChange={(e) => set({ max: num(e.target.value) })} />
          </label>
        </>
      ) : (
        <>
          <label className="fb-field">
            <span>Minimum length</span>
            <input
              type="number"
              value={validation.minLength ?? ""}
              onChange={(e) => set({ minLength: num(e.target.value) })}
            />
          </label>
          <label className="fb-field">
            <span>Maximum length</span>
            <input
              type="number"
              value={validation.maxLength ?? ""}
              onChange={(e) => set({ maxLength: num(e.target.value) })}
            />
          </label>
          <label className="fb-field">
            <span>Pattern (regular expression)</span>
            <input value={validation.pattern ?? ""} onChange={(e) => set({ pattern: e.target.value || undefined })} />
          </label>
        </>
      )}
    </div>
  );
}

const OPERATORS: { value: Condition["operator"]; label: string }[] = [
  { value: "equals", label: "is" },
  { value: "notEquals", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "greaterThan", label: "is greater than" },
  { value: "lessThan", label: "is less than" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
];

function optionValue(option: unknown): { label: string; value: string } | null {
  if (typeof option === "string") return { label: option, value: option };
  if (option && typeof option === "object" && "value" in option) {
    const o = option as { label?: unknown; value: unknown };
    return { label: typeof o.label === "string" ? o.label : String(o.value), value: String(o.value) };
  }
  return null;
}

function ConditionRow({
  condition,
  otherFields,
  onChange,
  onRemove,
}: {
  condition: Condition;
  otherFields: FieldConfig[];
  onChange: (patch: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  const referenced = otherFields.find((f) => f.id === condition.fieldId);
  const needsValue = condition.operator !== "isEmpty" && condition.operator !== "isNotEmpty";
  const options = Array.isArray(referenced?.defaultProps.options)
    ? (referenced.defaultProps.options as unknown[]).map(optionValue).filter((o): o is { label: string; value: string } => o !== null)
    : null;

  return (
    <div className="fb-condition-row">
      <select
        aria-label="Field to check"
        value={condition.fieldId}
        onChange={(e) => onChange({ fieldId: e.target.value, value: undefined })}
      >
        {otherFields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Comparison"
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value as Condition["operator"] })}
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      {needsValue &&
        (options ? (
          <select
            aria-label="Value"
            value={typeof condition.value === "string" ? condition.value : ""}
            onChange={(e) => onChange({ value: e.target.value })}
          >
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : referenced?.type === "checkbox" ? (
          <select
            aria-label="Value"
            value={condition.value === true ? "true" : "false"}
            onChange={(e) => onChange({ value: e.target.value === "true" })}
          >
            <option value="true">Checked</option>
            <option value="false">Unchecked</option>
          </select>
        ) : (
          <input
            aria-label="Value"
            value={typeof condition.value === "string" || typeof condition.value === "number" ? String(condition.value) : ""}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        ))}
      <button type="button" className="fb-canvas-delete" onClick={onRemove} aria-label="Remove condition">
        ×
      </button>
    </div>
  );
}

function VisibilitySection({
  field,
  otherFields,
  rule,
  onChange,
}: {
  field: FieldConfig;
  otherFields: FieldConfig[];
  rule: VisibilityRule | null;
  onChange: (rule: VisibilityRule | null) => void;
}) {
  const enabled = rule !== null;

  function toggle(checked: boolean) {
    if (!checked || otherFields.length === 0) {
      onChange(null);
      return;
    }
    onChange({ targetFieldId: field.id, match: "all", conditions: [{ fieldId: otherFields[0].id, operator: "isNotEmpty" }] });
  }

  function updateCondition(index: number, patch: Partial<Condition>) {
    if (!rule) return;
    onChange({ ...rule, conditions: rule.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  }

  function addCondition() {
    if (!rule || otherFields.length === 0) return;
    onChange({ ...rule, conditions: [...rule.conditions, { fieldId: otherFields[0].id, operator: "isNotEmpty" }] });
  }

  function removeCondition(index: number) {
    if (!rule) return;
    const conditions = rule.conditions.filter((_, i) => i !== index);
    onChange(conditions.length === 0 ? null : { ...rule, conditions });
  }

  return (
    <div className="fb-logic-section">
      <label className="fb-field fb-field-checkbox">
        <input
          type="checkbox"
          checked={enabled}
          disabled={otherFields.length === 0}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>Only show this field conditionally</span>
      </label>
      {otherFields.length === 0 && (
        <p className="fb-inspector-placeholder">Add another field first to set up conditional visibility.</p>
      )}
      {enabled && rule && (
        <>
          {rule.conditions.length > 1 && (
            <label className="fb-field">
              <span>Show when</span>
              <select value={rule.match} onChange={(e) => onChange({ ...rule, match: e.target.value as "all" | "any" })}>
                <option value="all">All conditions match</option>
                <option value="any">Any condition matches</option>
              </select>
            </label>
          )}
          {rule.conditions.map((condition, index) => (
            <ConditionRow
              key={index}
              condition={condition}
              otherFields={otherFields}
              onChange={(patch) => updateCondition(index, patch)}
              onRemove={() => removeCondition(index)}
            />
          ))}
          <button type="button" className="fb-add-condition" onClick={addCondition}>
            + Add condition
          </button>
        </>
      )}
    </div>
  );
}

function CalculatedSection({
  field,
  numberFields,
  formula,
  onChange,
}: {
  field: FieldConfig;
  numberFields: FieldConfig[];
  formula: string | null;
  onChange: (formula: string | null, inputs: string[]) => void;
}) {
  const [text, setText] = useState(formula ?? "");
  useEffect(() => setText(formula ?? ""), [formula]);
  const enabled = formula !== null;
  const validIds = new Set(numberFields.map((f) => f.id));

  function toggle(checked: boolean) {
    if (!checked || numberFields.length === 0) {
      onChange(null, []);
      return;
    }
    const initial = numberFields[0].id;
    setText(initial);
    onChange(initial, [initial]);
  }

  function commit(value: string) {
    setText(value);
    // Only identifiers that are actually a real number field count as inputs
    // — a formula mid-typed into a garbage state never gets saved with a
    // garbage input, which the schema would otherwise reject outright.
    const inputs = extractFormulaIdentifiers(value).filter((id) => validIds.has(id));
    if (inputs.length > 0) onChange(value, inputs);
  }

  function insertField(id: string) {
    commit(text ? `${text} ${id}` : id);
  }

  return (
    <div className="fb-logic-section">
      <label className="fb-field fb-field-checkbox">
        <input
          type="checkbox"
          checked={enabled}
          disabled={numberFields.length === 0}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>Calculate this value automatically</span>
      </label>
      {numberFields.length === 0 && <p className="fb-inspector-placeholder">Add another number field first.</p>}
      {enabled && (
        <>
          <label className="fb-field">
            <span>Formula</span>
            <input value={text} onChange={(e) => commit(e.target.value)} placeholder="e.g. seats * price_per_seat" />
          </label>
          <div className="fb-logic-chips">
            {numberFields.map((f) => (
              <button key={f.id} type="button" className="fb-logic-chip" onClick={() => insertField(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <p className="fb-inspector-placeholder">Supports + − × ÷ and parentheses. Click a field above to insert it.</p>
        </>
      )}
    </div>
  );
}

function LogicTab() {
  const definition = useBuilder((s) => s.definition);
  const selectedFieldId = useBuilder((s) => s.selectedFieldId)!;
  const setVisibilityRule = useBuilder((s) => s.setVisibilityRule);
  const setCalculatedField = useBuilder((s) => s.setCalculatedField);
  const field = definition.fields.find((f) => f.id === selectedFieldId)!;

  const otherFields = definition.fields.filter((f) => f.id !== selectedFieldId);
  const numberFields = otherFields.filter((f) => f.type === "number");
  const rule = definition.logic.visibility.find((r) => r.targetFieldId === selectedFieldId) ?? null;
  const calc = definition.logic.calculated.find((c) => c.targetFieldId === selectedFieldId) ?? null;

  return (
    <div className="fb-inspector-tab">
      <VisibilitySection
        field={field}
        otherFields={otherFields}
        rule={rule}
        onChange={(next) => setVisibilityRule(field.id, next)}
      />
      {field.type === "number" && (
        <CalculatedSection
          field={field}
          numberFields={numberFields}
          formula={calc?.formula ?? null}
          onChange={(formula, inputs) =>
            setCalculatedField(field.id, formula ? { targetFieldId: field.id, inputs, formula } : null)
          }
        />
      )}
    </div>
  );
}

function StyleTab() {
  const definition = useBuilder((s) => s.definition);
  const selectedFieldId = useBuilder((s) => s.selectedFieldId)!;
  const updateField = useBuilder((s) => s.updateField);
  const setFieldSpan = useBuilder((s) => s.setFieldSpan);
  const field = definition.fields.find((f) => f.id === selectedFieldId)!;
  const style = field.style ?? {};
  const span = fieldSpan(definition.layout.rows, field.id);
  const set = (patch: typeof style) => updateField(field.id, { style: { ...style, ...patch } });

  return (
    <div className="fb-inspector-tab">
      <label className="fb-field">
        <span>Width (1 to 12 columns)</span>
        <input
          type="number"
          min={1}
          max={12}
          value={span}
          onChange={(e) => setFieldSpan(field.id, Number(e.target.value) || 12)}
        />
      </label>
      <label className="fb-field">
        <span>Border colour</span>
        <input
          type="color"
          value={style.borderColor ?? "#d1d5db"}
          onChange={(e) => set({ borderColor: e.target.value })}
        />
      </label>
      <label className="fb-field">
        <span>Corner radius</span>
        <select value={style.radius ?? ""} onChange={(e) => set({ radius: (e.target.value || undefined) as never })}>
          <option value="">Theme default</option>
          <option value="none">None</option>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
          <option value="full">Full</option>
        </select>
      </label>
    </div>
  );
}

function ThemeContrastWarning() {
  const primary = useBuilder((s) => s.definition.theme.colors?.primary);
  if (!primary) return null;
  const ratio = contrastAgainstWhite(primary);
  if (ratio === null || ratio >= WCAG_AA_NORMAL_TEXT) return null;
  return (
    <p className="fb-contrast-warning" role="alert">
      This primary colour has a contrast ratio of {ratio.toFixed(2)}:1 against white button text — below the WCAG AA
      minimum of {WCAG_AA_NORMAL_TEXT}:1. Consider a darker colour.
    </p>
  );
}

function ThemeTab() {
  const theme = useBuilder((s) => s.definition.theme);
  const setTheme = useBuilder((s) => s.setTheme);

  return (
    <div className="fb-inspector-tab">
      <label className="fb-field">
        <span>Primary colour</span>
        <input
          type="color"
          value={theme.colors?.primary ?? "#2563eb"}
          onChange={(e) => setTheme({ colors: { ...theme.colors, primary: e.target.value } })}
        />
      </label>
      <ThemeContrastWarning />
      <label className="fb-field">
        <span>Corner radius</span>
        <select value={theme.radius ?? "md"} onChange={(e) => setTheme({ radius: e.target.value as never })}>
          <option value="none">None</option>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
          <option value="full">Full</option>
        </select>
      </label>
      <label className="fb-field">
        <span>Density</span>
        <select value={theme.density ?? "comfortable"} onChange={(e) => setTheme({ density: e.target.value as never })}>
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </label>
      <label className="fb-field fb-field-checkbox">
        <input
          type="checkbox"
          checked={theme.accentBorder ?? false}
          onChange={(e) => setTheme({ accentBorder: e.target.checked })}
        />
        <span>Show an accent border and heading underline in this colour</span>
      </label>
    </div>
  );
}

export function Inspector() {
  const selectedFieldId = useBuilder((s) => s.selectedFieldId);
  const selectedFieldExists = useBuilder((s) => s.definition.fields.some((f) => f.id === s.selectedFieldId));

  if (!selectedFieldId || !selectedFieldExists) {
    return (
      <div className="fb-inspector" aria-label="Inspector">
        <h2 className="fb-inspector-title">Theme</h2>
        <ThemeTab />
      </div>
    );
  }

  return (
    <div className="fb-inspector" aria-label="Inspector">
      <Tabs.Root defaultValue="basic" className="fb-tabs">
        <Tabs.List className="fb-tabs-list" aria-label="Field settings">
          <Tabs.Trigger className="fb-tabs-trigger" value="basic">
            Basic
          </Tabs.Trigger>
          <Tabs.Trigger className="fb-tabs-trigger" value="validation">
            Validation
          </Tabs.Trigger>
          <Tabs.Trigger className="fb-tabs-trigger" value="logic">
            Logic
          </Tabs.Trigger>
          <Tabs.Trigger className="fb-tabs-trigger" value="style">
            Style
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="basic">
          <BasicTab />
        </Tabs.Content>
        <Tabs.Content value="validation">
          <ValidationTab />
        </Tabs.Content>
        <Tabs.Content value="logic">
          <LogicTab />
        </Tabs.Content>
        <Tabs.Content value="style">
          <StyleTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
