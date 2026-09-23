import type { FieldTypeMeta } from "./store";

export const FIELD_CATALOG: FieldTypeMeta[] = [
  {
    type: "text",
    label: "Text",
    category: "Basic",
    create: () => ({ label: "Text field", defaultProps: { placeholder: "" } }),
  },
  {
    type: "email",
    label: "Email",
    category: "Basic",
    create: () => ({ label: "Email", defaultProps: { placeholder: "" } }),
  },
  {
    type: "number",
    label: "Number",
    category: "Basic",
    create: () => ({ label: "Number" }),
  },
  {
    type: "textarea",
    label: "Paragraph",
    category: "Basic",
    create: () => ({ label: "Paragraph", defaultProps: { rows: 4 } }),
  },
  {
    type: "select",
    label: "Dropdown",
    category: "Choice",
    create: () => ({ label: "Dropdown", defaultProps: { options: ["Option 1", "Option 2"] } }),
  },
  {
    type: "radio",
    label: "Multiple choice",
    category: "Choice",
    create: () => ({ label: "Multiple choice", defaultProps: { options: ["Option 1", "Option 2"] } }),
  },
  {
    type: "checkbox",
    label: "Checkbox",
    category: "Choice",
    create: () => ({ label: "Checkbox" }),
  },
  {
    type: "date",
    label: "Date",
    category: "Date & Time",
    create: () => ({ label: "Date" }),
  },
];

export function fieldMetaFor(type: string): FieldTypeMeta | undefined {
  return FIELD_CATALOG.find((f) => f.type === type);
}

export const FIELD_CATEGORIES = Array.from(new Set(FIELD_CATALOG.map((f) => f.category)));
