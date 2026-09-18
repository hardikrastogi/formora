import { z } from "zod";

export const ConditionOperatorSchema = z.enum([
  "equals",
  "notEquals",
  "contains",
  "greaterThan",
  "lessThan",
  "isEmpty",
  "isNotEmpty",
]);

export const ConditionSchema = z.object({
  fieldId: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: z.unknown().optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

export const VisibilityRuleSchema = z.object({
  targetFieldId: z.string().min(1),
  match: z.enum(["all", "any"]).default("all"),
  conditions: z.array(ConditionSchema).min(1),
});

export type VisibilityRule = z.infer<typeof VisibilityRuleSchema>;

export const CalculatedFieldSchema = z.object({
  targetFieldId: z.string().min(1),
  inputs: z.array(z.string().min(1)).min(1),
  formula: z.string().min(1),
});

export type CalculatedField = z.infer<typeof CalculatedFieldSchema>;

export const LogicSchema = z
  .object({
    visibility: z.array(VisibilityRuleSchema).default([]),
    calculated: z.array(CalculatedFieldSchema).default([]),
  })
  .default({ visibility: [], calculated: [] });

export type Logic = z.infer<typeof LogicSchema>;
