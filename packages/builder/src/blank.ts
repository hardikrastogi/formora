import type { FormDefinition } from "@hardikrastogi/core";

export function createBlankDefinition(id: string, name = "Untitled form"): FormDefinition {
  const now = new Date().toISOString();
  return {
    id,
    name,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    fields: [],
    layout: { rows: [] },
    theme: {},
    logic: { visibility: [], calculated: [] },
  };
}
