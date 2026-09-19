import { useId, useRef, type CSSProperties } from "react";
import * as Label from "@radix-ui/react-label";
import { Controller, type UseFormReturn } from "react-hook-form";
import type { FieldPluginRegistry, FormDefinitionInput } from "@hardikrastogi/core";
import { fieldStyleToCssVars, themeToCssVars } from "./theme";
import { cx, type FormClassNames } from "./types";
import { useFormRenderer, type RenderedColumn } from "./use-form-renderer";
import type { Answers } from "./validate";

export interface FormRendererProps {
  definition: FormDefinitionInput;
  onSubmit?: (answers: Answers) => void | Promise<void>;
  registry?: FieldPluginRegistry;
  defaultValues?: Answers;
  classNames?: FormClassNames;
  submitLabel?: string;
  disabled?: boolean;
  className?: string;
}

interface FieldCellProps {
  column: RenderedColumn;
  form: UseFormReturn<Answers>;
  baseId: string;
  classNames: FormClassNames;
  disabled: boolean;
}

function FieldCell({ column, form, baseId, classNames, disabled }: FieldCellProps) {
  const { field, plugin, span } = column;
  const style = fieldStyleToCssVars(field.style, span);

  if (!plugin) {
    return (
      <div className={cx("df-field", "df-field-unsupported", classNames.field)} style={style} role="alert">
        Unsupported field type &quot;{field.type}&quot; (field &quot;{field.id}&quot;)
      </div>
    );
  }

  const inputId = `${baseId}-${field.id}`;
  const labelId = `${inputId}-label`;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const props = { ...plugin.defaultProps, ...field.defaultProps };
  const kind = plugin.labelKind ?? "control";
  const Renderer = plugin.Renderer;

  const required = field.required ? (
    <span className={cx("df-required", classNames.required)} aria-hidden="true">
      {" "}
      *
    </span>
  ) : null;

  return (
    <Controller
      name={field.id}
      control={form.control}
      render={({ field: rhf, fieldState }) => {
        const error = fieldState.error?.message;
        const describedBy = cx(field.description && descriptionId, error && errorId) || undefined;
        return (
          <div
            className={cx("df-field", classNames.field)}
            style={style}
            data-field-type={field.type}
            data-invalid={error ? "" : undefined}
          >
            {kind === "control" && (
              <Label.Root htmlFor={inputId} className={cx("df-label", classNames.label)}>
                {field.label}
                {required}
              </Label.Root>
            )}
            {kind === "group" && (
              <div id={labelId} className={cx("df-label", classNames.label)}>
                {field.label}
                {required}
              </div>
            )}
            <Renderer
              field={field}
              props={props}
              inputId={inputId}
              labelId={labelId}
              describedBy={describedBy}
              value={rhf.value}
              onChange={rhf.onChange}
              onBlur={rhf.onBlur}
              invalid={Boolean(error)}
              disabled={disabled}
              classNames={classNames}
            />
            {field.description && (
              <p id={descriptionId} className={cx("df-description", classNames.description)}>
                {field.description}
              </p>
            )}
            {error && (
              <p id={errorId} className={cx("df-error", classNames.error)} role="alert">
                {error}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}

export function FormRenderer({
  definition,
  onSubmit,
  registry,
  defaultValues,
  classNames = {},
  submitLabel = "Submit",
  disabled = false,
  className,
}: FormRendererProps) {
  const baseId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const r = useFormRenderer(definition, { registry, defaultValues, onSubmit });

  if (!r.definition) {
    return (
      <div className="df-form df-form-invalid" role="alert">
        <p>This form definition is invalid:</p>
        <ul>
          {r.definitionIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </div>
    );
  }

  const style: CSSProperties = themeToCssVars(r.definition.theme);

  return (
    <form
      ref={formRef}
      className={cx("df-form", classNames.form, className)}
      style={style}
      noValidate
      aria-busy={r.isSubmitting || undefined}
      onSubmit={async (event) => {
        await r.submit(event);
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      }}
    >
      {r.rows.map((row) => (
        <div key={row.id} className={cx("df-row", classNames.row)}>
          {row.columns.map((column) => (
            <FieldCell
              key={column.field.id}
              column={column}
              form={r.form}
              baseId={baseId}
              classNames={classNames}
              disabled={disabled || r.isSubmitting}
            />
          ))}
        </div>
      ))}
      {r.submitError && (
        <p className="df-form-error" role="alert">
          {r.submitError}
        </p>
      )}
      <button type="submit" className={cx("df-submit", classNames.submit)} disabled={disabled || r.isSubmitting}>
        {submitLabel}
      </button>
    </form>
  );
}
