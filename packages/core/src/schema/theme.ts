import { z } from "zod";

export const ThemeSchema = z
  .object({
    colors: z
      .object({
        primary: z.string().default("#2563eb"),
        background: z.string().optional(),
        text: z.string().optional(),
      })
      .partial()
      .default({}),
    radius: z.enum(["none", "sm", "md", "lg", "full"]).default("md"),
    font: z.string().default("Inter"),
    density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  })
  .partial()
  .default({});

export type Theme = z.infer<typeof ThemeSchema>;
