import * as Tabs from "@radix-ui/react-tabs";
import type { ChangeEvent } from "react";
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

function LogicTab() {
  return (
    <div className="fb-inspector-tab">
      <p className="fb-inspector-placeholder">
        Conditional visibility and calculated fields are coming in a later phase. The rules can already be stored in
        the form&apos;s JSON — this tab will let you build them without writing JSON by hand.
      </p>
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
