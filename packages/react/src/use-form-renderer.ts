import { useCallback, useMemo, useState } from "react";
import { useForm, type FieldErrors, type Resolver, type UseFormReturn } from "react-hook-form";
import {
  FormDefinitionSchema,
  type FieldConfig,
  type FieldPluginRegistry,
  type FormDefinition,
  type FormDefinitionInput,
} from "@hardikrastogi/core";
import { defaultRegistry } from "./registry";
import type { ReactFieldPlugin } from "./types";
import { cleanAnswers, collectErrors, type Answers } from "./validate";

export interface RenderedColumn {
  span: number;
  field: FieldConfig;
  /** undefined when no plugin is registered for field.type */
  plugin: ReactFieldPlugin | undefined;
}

export interface RenderedRow {
  id: string;
  columns: RenderedColumn[];
}

export interface UseFormRendererOptions {
  registry?: FieldPluginRegistry;
  defaultValues?: Answers;
  onSubmit?: (answers: Answers) => void | Promise<void>;
}

export interface UseFormRendererResult {
  definition: FormDefinition | null;
  /** Human-readable problems when the definition itself is invalid. */
  definitionIssues: string[];
  rows: RenderedRow[];
  form: UseFormReturn<Answers>;
  registry: FieldPluginRegistry;
  submit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  submitError: string | null;
  isSubmitting: boolean;
}

function buildRows(def: FormDefinition, registry: FieldPluginRegistry): RenderedRow[] {
  const byId = new Map(def.fields.map((f) => [f.id, f]));
  const placed = new Set<string>();
  const rows: RenderedRow[] = [];

  const column = (field: FieldConfig, span: number): RenderedColumn => ({
    span,
    field,
    plugin: registry.get(field.type) as ReactFieldPlugin | undefined,
  });

  for (const row of def.layout.rows) {
    const columns: RenderedColumn[] = [];
    for (const col of row.columns) {
      const field = byId.get(col.fieldId);
      if (!field || placed.has(field.id)) continue;
      placed.add(field.id);
      columns.push(column(field, col.span));
    }
    if (columns.length > 0) rows.push({ id: row.id, columns });
  }

  // A field missing from the layout must never silently disappear.
  for (const field of def.fields) {
    if (!placed.has(field.id)) rows.push({ id: `auto_${field.id}`, columns: [column(field, 12)] });
  }

  return rows;
}

function buildDefaults(
  def: FormDefinition | null,
  registry: FieldPluginRegistry,
  overrides: Answers | undefined,
): Answers {
  const values: Answers = {};
  for (const field of def?.fields ?? []) {
    const plugin = registry.get(field.type) as ReactFieldPlugin | undefined;
    const initial = field.defaultProps.defaultValue ?? plugin?.emptyValue;
    if (initial !== undefined) values[field.id] = initial;
  }
  return { ...values, ...overrides };
}

export function useFormRenderer(
  input: FormDefinitionInput,
  options: UseFormRendererOptions = {},
): UseFormRendererResult {
  const registry = options.registry ?? defaultRegistry;

  const parsed = useMemo(() => FormDefinitionSchema.safeParse(input), [input]);
  const definition = parsed.success ? parsed.data : null;
  const definitionIssues = parsed.success
    ? []
    : parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

  const rows = useMemo(() => (definition ? buildRows(definition, registry) : []), [definition, registry]);

  const resolver: Resolver<Answers> = useCallback(
    async (values) => {
      if (!definition) return { values, errors: {} };
      const errors = collectErrors(definition, registry, values);
      const ids = Object.keys(errors);
      if (ids.length === 0) return { values, errors: {} };
      const fieldErrors: Record<string, { type: string; message: string }> = {};
      for (const id of ids) fieldErrors[id] = { type: "validate", message: errors[id][0] };
      return { values: {}, errors: fieldErrors as FieldErrors<Answers> };
    },
    [definition, registry],
  );

  const form = useForm<Answers>({
    defaultValues: buildDefaults(definition, registry, options.defaultValues),
    resolver,
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const onSubmit = options.onSubmit;

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit?.(cleanAnswers(values));
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : "Submission failed. Please try again.");
    }
  });

  return {
    definition,
    definitionIssues,
    rows,
    form,
    registry,
    submit,
    submitError,
    isSubmitting: form.formState.isSubmitting,
  };
}
