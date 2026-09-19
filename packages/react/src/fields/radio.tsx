import * as RadioGroup from "@radix-ui/react-radio-group";
import { z } from "zod";
import { cx, type FieldRendererProps, type ReactFieldPlugin } from "../types";
import { normalizeOptions } from "./options";

function RadioInput(p: FieldRendererProps) {
  const options = normalizeOptions(p.props.options);
  return (
    <RadioGroup.Root
      id={p.inputId}
      className="df-radio-group"
      name={p.field.id}
      value={typeof p.value === "string" ? p.value : ""}
      disabled={p.disabled}
      aria-labelledby={p.labelId}
      aria-invalid={p.invalid || undefined}
      aria-required={p.field.required || undefined}
      aria-describedby={p.describedBy}
      onValueChange={p.onChange}
      onBlur={p.onBlur}
    >
      {options.map((o, i) => {
        const optionId = `${p.inputId}-opt-${i}`;
        return (
          <div key={o.value} className={cx("df-option", p.classNames.option)}>
            <RadioGroup.Item id={optionId} className="df-radio" value={o.value}>
              <RadioGroup.Indicator className="df-radio-indicator" />
            </RadioGroup.Item>
            <label htmlFor={optionId} className="df-option-label">
              {o.label}
            </label>
          </div>
        );
      })}
    </RadioGroup.Root>
  );
}

export const radioPlugin: ReactFieldPlugin = {
  type: "radio",
  schema: z.string(),
  defaultProps: { options: [] },
  emptyValue: "",
  labelKind: "group",
  Renderer: RadioInput,
};
