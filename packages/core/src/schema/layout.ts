import { z } from "zod";

export const GridColumnSchema = z.object({
  span: z.number().int().min(1).max(12),
  fieldId: z.string().min(1),
});

export type GridColumn = z.infer<typeof GridColumnSchema>;

export const GridRowSchema = z.object({
  id: z.string().min(1),
  columns: z.array(GridColumnSchema),
});

export type GridRow = z.infer<typeof GridRowSchema>;

export const LayoutSchema = z.object({
  rows: z.array(GridRowSchema).default([]),
});

export type Layout = z.infer<typeof LayoutSchema>;
