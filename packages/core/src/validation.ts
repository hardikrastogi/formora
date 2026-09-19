import type { FormDefinition } from "./schema/form-definition";
import type { FieldConfig } from "./schema/field";

export interface SubmissionValidationResult {
  success: boolean;
  errors: Record<string, string[]>;
}

function validateField(field: FieldConfig, value: unknown): string[] {
  const errors: string[] = [];
  const isEmpty =
    value === undefined ||
    value === null ||
    value === "" ||
    value === false ||
    (Array.isArray(value) && value.length === 0);

  if (field.required && isEmpty) {
    errors.push(`"${field.label}" is required`);
    return errors;
  }

  if (isEmpty) return errors;

  const rules = field.validation;
  if (!rules) return errors;

  if (typeof value === "string") {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push(`"${field.label}" must be at least ${rules.minLength} characters`);
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push(`"${field.label}" must be at most ${rules.maxLength} characters`);
    }
    if (rules.pattern !== undefined && !new RegExp(rules.pattern).test(value)) {
      errors.push(`"${field.label}" does not match the required format`);
    }
  }

  if (typeof value === "number") {
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`"${field.label}" must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && value > rules.max) {
      errors.push(`"${field.label}" must be at most ${rules.max}`);
    }
  }

  return errors;
}

export function validateSubmission(
  definition: FormDefinition,
  answers: Record<string, unknown>
): SubmissionValidationResult {
  const errors: Record<string, string[]> = {};

  for (const field of definition.fields) {
    const fieldErrors = validateField(field, answers[field.id]);
    if (fieldErrors.length > 0) {
      errors[field.id] = fieldErrors;
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
}
