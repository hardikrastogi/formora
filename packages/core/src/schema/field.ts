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

export const FieldStyleSchema = z
  .object({
    textColor: z.string(),
    backgroundColor: z.string(),
    borderColor: z.string(),
    radius: z.enum(["none", "sm", "md", "lg", "full"]),
    fontSize: z.string(),
  })
  .partial();

export type FieldStyle = z.infer<typeof FieldStyleSchema>;

export const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export const FieldConfigSchema = z.object({
  id: z
    .string()
    .regex(FIELD_ID_PATTERN, "Field id must start with a letter and contain only letters, digits, _ or -")
    .refine((id) => id !== "__proto__" && id !== "constructor" && id !== "prototype"),
  type: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(false),
  defaultProps: z.record(z.string(), z.unknown()).default({}),
  validation: FieldValidationSchema.optional(),
  style: FieldStyleSchema.optional(),
});

export type FieldConfig = z.infer<typeof FieldConfigSchema>;
