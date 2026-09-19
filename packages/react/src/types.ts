import type { ComponentType } from "react";
import type { FieldConfig, FieldTypePlugin } from "@hardikrastogi/core";

export type FormClassNameSlot =
  | "form"
  | "row"
  | "field"
  | "label"
  | "input"
  | "option"
  | "description"
  | "error"
  | "required"
  | "submit";

export type FormClassNames = Partial<Record<FormClassNameSlot, string>>;

export interface FieldRendererProps {
  field: FieldConfig;
  /** Plugin defaultProps merged with the field's own defaultProps (field wins). */
  props: Record<string, unknown>;
  inputId: string;
  labelId: string;
  describedBy?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  invalid: boolean;
  disabled: boolean;
  classNames: FormClassNames;
}

/**
 * control: label is tied to a single input (htmlFor)
 * group:   label names a group of controls (radio group)
 * inline:  the field draws its own label (checkbox)
 */
export type LabelKind = "control" | "group" | "inline";

export interface ReactFieldPlugin extends Omit<FieldTypePlugin, "Renderer" | "Editor"> {
  Renderer: ComponentType<FieldRendererProps>;
  labelKind?: LabelKind;
  /** Initial answer when the form has no other default for this field. */
  emptyValue?: unknown;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
