import { z } from "zod";

export const FieldValidationSchema = z
  .object({
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  })
  .partial();

export type FieldValidation = z.infer<typeof FieldValidationSchema>;

export const FieldConfigSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(false),
  defaultProps: z.record(z.string(), z.unknown()).default({}),
  validation: FieldValidationSchema.optional(),
});

export type FieldConfig = z.infer<typeof FieldConfigSchema>;
