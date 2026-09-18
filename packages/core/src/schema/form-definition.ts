import { z } from "zod";
import { FieldConfigSchema } from "./field";
import { LayoutSchema } from "./layout";
import { ThemeSchema } from "./theme";
import { LogicSchema } from "./logic";

export const FormDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    schemaVersion: z.number().int().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    fields: z.array(FieldConfigSchema),
    layout: LayoutSchema,
    theme: ThemeSchema,
    logic: LogicSchema,
  })
  .superRefine((def, ctx) => {
    const fieldIds = new Set<string>();
    for (const field of def.fields) {
      if (fieldIds.has(field.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field id: "${field.id}"`,
          path: ["fields"],
        });
      }
      fieldIds.add(field.id);
    }

    for (const row of def.layout.rows) {
      const spanSum = row.columns.reduce((sum, col) => sum + col.span, 0);
      if (spanSum > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Row "${row.id}" columns sum to ${spanSum}, which exceeds 12`,
          path: ["layout", "rows"],
        });
      }
      for (const col of row.columns) {
        if (!fieldIds.has(col.fieldId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Layout references unknown fieldId: "${col.fieldId}"`,
            path: ["layout", "rows"],
          });
        }
      }
    }

    for (const rule of def.logic.visibility) {
      if (!fieldIds.has(rule.targetFieldId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Visibility rule targets unknown fieldId: "${rule.targetFieldId}"`,
          path: ["logic", "visibility"],
        });
      }
    }
  });

export type FormDefinition = z.infer<typeof FormDefinitionSchema>;
