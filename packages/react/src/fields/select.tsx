import { z } from "zod";
import { cx, type FieldRendererProps, type ReactFieldPlugin } from "../types";
import { normalizeOptions, str } from "./options";

// Native <select>: fully accessible, best mobile UX, no extra dependency.
function SelectInput(p: FieldRendererProps) {
  const options = normalizeOptions(p.props.options);
  return (
    <select
      id={p.inputId}
      className={cx("df-input", "df-select", p.classNames.input)}
      name={p.field.id}
      value={typeof p.value === "string" ? p.value : ""}
      disabled={p.disabled}
      aria-invalid={p.invalid || undefined}
      aria-required={p.field.required || undefined}
      aria-describedby={p.describedBy}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    >
      <option value="">{str(p.props.placeholder, "Select an option")}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export const selectPlugin: ReactFieldPlugin = {
  type: "select",
  schema: z.string(),
  defaultProps: { placeholder: "Select an option", options: [] },
  emptyValue: "",
  labelKind: "control",
  Renderer: SelectInput,
};
