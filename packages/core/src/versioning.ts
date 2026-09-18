import type { FormDefinition } from "./schema/form-definition";
import type { FormSubmission } from "./schema/form-submission";

/**
 * A submission is only safe to re-render/re-validate against the CURRENT
 * FormDefinition if their schemaVersions match. Otherwise the submission
 * must be treated as read-only historical data, rendered from whatever
 * snapshot of the definition was current at submission time.
 */
export function isSubmissionCurrent(
  submission: FormSubmission,
  definition: FormDefinition
): boolean {
  return submission.schemaVersion === definition.schemaVersion;
}

export function bumpSchemaVersion(definition: FormDefinition): FormDefinition {
  return {
    ...definition,
    schemaVersion: definition.schemaVersion + 1,
    updatedAt: new Date().toISOString(),
  };
}
