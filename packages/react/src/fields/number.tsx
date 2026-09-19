import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { cx, type FieldRendererProps, type ReactFieldPlugin } from "../types";
import { str } from "./options";

const PARTIAL_NUMBER = /^-?\d*\.?\d*$/;
const FULL_NUMBER = /^-?\d+(\.\d+)?$/;

function NumberInput(p: FieldRendererProps) {
  const [text, setText] = useState(() => (typeof p.value === "number" ? String(p.value) : ""));
  const lastEmitted = useRef<unknown>(p.value);

  useEffect(() => {
    if (!Object.is(p.value, lastEmitted.current)) {
      lastEmitted.current = p.value;
      setText(typeof p.value === "number" ? String(p.value) : "");
    }
  }, [p.value]);

  return (
    <input
      id={p.inputId}
      className={cx("df-input", p.classNames.input)}
      type="text"
      inputMode="decimal"
      name={p.field.id}
      value={text}
      placeholder={str(p.props.placeholder) || undefined}
      disabled={p.disabled}
      aria-invalid={p.invalid || undefined}
      aria-required={p.field.required || undefined}
      aria-describedby={p.describedBy}
      onChange={(e) => {
        const raw = e.target.value;
        if (!PARTIAL_NUMBER.test(raw)) return;
        setText(raw);
        const next = FULL_NUMBER.test(raw) ? Number(raw) : undefined;
        lastEmitted.current = next;
        p.onChange(next);
      }}
      onBlur={p.onBlur}
    />
  );
}

export const numberPlugin: ReactFieldPlugin = {
  type: "number",
  schema: z.number(),
  defaultProps: { placeholder: "" },
  labelKind: "control",
  Renderer: NumberInput,
};
