import { z } from "zod";
import { cx, type FieldRendererProps, type ReactFieldPlugin } from "../types";
import { str } from "./options";
import { EMAIL_PATTERN, URL_PATTERN } from "./patterns";

type TextInputKind = "text" | "email" | "date" | "url" | "time";

function makeInput(kind: TextInputKind) {
  return function TextLikeInput(p: FieldRendererProps) {
    return (
      <input
        id={p.inputId}
        className={cx("df-input", p.classNames.input)}
        type={kind}
        name={p.field.id}
        value={typeof p.value === "string" ? p.value : ""}
        placeholder={str(p.props.placeholder) || undefined}
        autoComplete={str(p.props.autoComplete) || undefined}
        disabled={p.disabled}
        aria-invalid={p.invalid || undefined}
        aria-required={p.field.required || undefined}
        aria-describedby={p.describedBy}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
      />
    );
  };
}

function TextareaInput(p: FieldRendererProps) {
  const rows = typeof p.props.rows === "number" ? p.props.rows : 4;
  return (
    <textarea
      id={p.inputId}
      className={cx("df-input", "df-textarea", p.classNames.input)}
      name={p.field.id}
      rows={rows}
      value={typeof p.value === "string" ? p.value : ""}
      placeholder={str(p.props.placeholder) || undefined}
      disabled={p.disabled}
      aria-invalid={p.invalid || undefined}
      aria-required={p.field.required || undefined}
      aria-describedby={p.describedBy}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    />
  );
}


export const textPlugin: ReactFieldPlugin = {
  type: "text",
  schema: z.string(),
  defaultProps: { placeholder: "" },
  emptyValue: "",
  labelKind: "control",
  Renderer: makeInput("text"),
};

export const emailPlugin: ReactFieldPlugin = {
  type: "email",
  schema: z.string().email(),
  defaultProps: { placeholder: "", autoComplete: "email" },
  emptyValue: "",
  labelKind: "control",
  Renderer: makeInput("email"),
  validate: (value) =>
    typeof value === "string" && EMAIL_PATTERN.test(value)
      ? { valid: true, errors: [] }
      : { valid: false, errors: ["Enter a valid email address"] },
};

export const datePlugin: ReactFieldPlugin = {
  type: "date",
  schema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  defaultProps: {},
  emptyValue: "",
  labelKind: "control",
  Renderer: makeInput("date"),
};

export const timePlugin: ReactFieldPlugin = {
  type: "time",
  schema: z.string().regex(/^\d{2}:\d{2}$/),
  defaultProps: {},
  emptyValue: "",
  labelKind: "control",
  Renderer: makeInput("time"),
};


export const urlPlugin: ReactFieldPlugin = {
  type: "url",
  schema: z.string().url(),
  defaultProps: { placeholder: "https://" },
  emptyValue: "",
  labelKind: "control",
  Renderer: makeInput("url"),
  validate: (value) =>
    typeof value === "string" && URL_PATTERN.test(value)
      ? { valid: true, errors: [] }
      : { valid: false, errors: ["Enter a valid URL, starting with http:// or https://"] },
};

export const textareaPlugin: ReactFieldPlugin = {
  type: "textarea",
  schema: z.string(),
  defaultProps: { placeholder: "", rows: 4 },
  emptyValue: "",
  labelKind: "control",
  Renderer: TextareaInput,
};
