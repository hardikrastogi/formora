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
    // Off by default — colors.primary always has a value (even when the
    // creator never touched the theme), so an accent border/heading driven
    // by it must be an explicit opt-in, not something every form shows
    // unasked just because a default color exists.
    accentBorder: z.boolean().default(false),
  })
  .partial()
  .default({});

export type Theme = z.infer<typeof ThemeSchema>;
