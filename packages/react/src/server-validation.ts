import { validateSubmission, type FormDefinition } from "@hardikrastogi/core";
import { EMAIL_PATTERN, URL_PATTERN } from "./fields/patterns";

/**
 * A server-safe (no React, no "use client") re-implementation of the same
 * type-specific checks the built-in field components run client-side. It
 * exists because the main @hardikrastogi/react entry ships as a single
 * "use client" bundle (required for <FormRenderer>), and Next.js refuses
 * to import ANYTHING from a "use client" module in server code — even a
 * plain function with zero React in it. Import this from
 * "@hardikrastogi/react/server" instead of the main entry point.
 *
 * Only covers types with a custom format check today (email, url); every
 * other built-in type is fully covered by core's validateSubmission alone.
 * A form using a custom field type registered only in the browser can't be
 * re-checked here.
 */
const TYPE_CHECKS: Record<string, (value: unknown) => string | null> = {
  email: (value) =>
    typeof value === "string" && EMAIL_PATTERN.test(value) ? null : "Enter a valid email address",
  url: (value) =>
    typeof value === "string" && URL_PATTERN.test(value)
      ? null
      : "Enter a valid URL, starting with http:// or https://",
};

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export function collectServerErrors(
  definition: FormDefinition,
  answers: Record<string, unknown>,
): Record<string, string[]> {
  const errors: Record<string, string[]> = { ...validateSubmission(definition, answers).errors };

  for (const field of definition.fields) {
    if (errors[field.id]) continue;
    const value = answers[field.id];
    if (isBlank(value)) continue;
    const check = TYPE_CHECKS[field.type];
    if (!check) continue;
    const message = check(value);
    if (message) errors[field.id] = [message];
  }

  return errors;
}
