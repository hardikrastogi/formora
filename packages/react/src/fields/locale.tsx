import { z } from "zod";
import { cx, type FieldRendererProps, type ReactFieldPlugin } from "../types";
import { normalizeOptions, str } from "./options";
import { COUNTRIES } from "./data/countries";
import { CURRENCIES } from "./data/currencies";

// Same native <select>, just with a real default option list baked in.
function LocaleSelect(p: FieldRendererProps) {
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

export const countryPlugin: ReactFieldPlugin = {
  type: "country",
  schema: z.string().length(2),
  defaultProps: { placeholder: "Select a country", options: COUNTRIES },
  emptyValue: "",
  labelKind: "control",
  Renderer: LocaleSelect,
};

export const currencyPlugin: ReactFieldPlugin = {
  type: "currency",
  schema: z.string(),
  defaultProps: { placeholder: "Select a currency", options: CURRENCIES },
  emptyValue: "",
  labelKind: "control",
  Renderer: LocaleSelect,
};
