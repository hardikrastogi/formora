import { z } from "zod";

export const FormSubmissionMetaSchema = z
  .object({
    submittedAt: z.string().datetime(),
    ip: z.string().optional(),
    userAgent: z.string().optional(),
  })
  .partial();

export type FormSubmissionMeta = z.infer<typeof FormSubmissionMetaSchema>;

export const FormSubmissionSchema = z.object({
  formId: z.string().min(1),
  schemaVersion: z.number().int().min(1),
  answers: z.record(z.string(), z.unknown()),
  meta: FormSubmissionMetaSchema.default({}),
});

export type FormSubmission = z.infer<typeof FormSubmissionSchema>;
