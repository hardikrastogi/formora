import {
  validateSubmission,
  type FieldPluginRegistry,
  type FormDefinition,
} from "@hardikrastogi/core";

export type Answers = Record<string, unknown>;

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Core rules (required/min/max/pattern) first, then each field type's own
 * `validate` hook (e.g. email format). One message list per field id.
 */
export function collectErrors(
  definition: FormDefinition,
  registry: FieldPluginRegistry,
  answers: Answers,
): Record<string, string[]> {
  const errors: Record<string, string[]> = { ...validateSubmission(definition, answers).errors };

  for (const field of definition.fields) {
    if (errors[field.id]) continue;
    const plugin = registry.get(field.type);
    const value = answers[field.id];
    if (!plugin?.validate || isBlank(value)) continue;
    const result = plugin.validate(value, { ...plugin.defaultProps, ...field.defaultProps });
    if (!result.valid) errors[field.id] = result.errors;
  }

  return errors;
}

export function cleanAnswers(values: Answers): Answers {
  const out: Answers = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    out[key] = value;
  }
  return out;
}
