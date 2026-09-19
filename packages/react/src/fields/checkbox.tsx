import * as Checkbox from "@radix-ui/react-checkbox";
import * as Label from "@radix-ui/react-label";
import { z } from "zod";
import { cx, type FieldRendererProps, type ReactFieldPlugin } from "../types";

function CheckboxInput(p: FieldRendererProps) {
  return (
    <div className={cx("df-option", p.classNames.option)}>
      <Checkbox.Root
        id={p.inputId}
        className="df-checkbox"
        name={p.field.id}
        checked={p.value === true}
        disabled={p.disabled}
        aria-invalid={p.invalid || undefined}
        aria-required={p.field.required || undefined}
        aria-describedby={p.describedBy}
        onCheckedChange={(checked) => p.onChange(checked === true)}
        onBlur={p.onBlur}
      >
        <Checkbox.Indicator className="df-checkbox-indicator">✓</Checkbox.Indicator>
      </Checkbox.Root>
      <Label.Root htmlFor={p.inputId} className={cx("df-option-label", p.classNames.label)}>
        {p.field.label}
        {p.field.required && (
          <span className={cx("df-required", p.classNames.required)} aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </Label.Root>
    </div>
  );
}

export const checkboxPlugin: ReactFieldPlugin = {
  type: "checkbox",
  schema: z.boolean(),
  defaultProps: {},
  emptyValue: false,
  labelKind: "inline",
  Renderer: CheckboxInput,
};
