import { z } from "zod";

/**
 * One place that knows every environment variable this app reads, what
 * shape it must have, and how they depend on each other (Resend needs a key
 * AND a from-address; Google needs both halves of its pair, never one
 * alone). Application code calls `getEnv()` instead of reading
 * `process.env.*` directly, so a misconfiguration surfaces immediately, as
 * one readable error, the moment it's first needed — not as a live 500 on
 * whatever request happens to touch the broken value.
 *
 * `getEnv()` is called lazily, inside request handling, never at module top
 * level — the same reason auth.ts builds its NextAuth config inside a
 * function. Calling it eagerly at import time could make `next build`'s
 * page-collection pass throw over env vars a given deployment (a preview,
 * a local build) never actually needed.
 */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    MONGODB_URI: z
      .string()
      .min(1, "MONGODB_URI is required — see apps/web/.env.example")
      .refine(
        (v) => v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"),
        "MONGODB_URI must start with mongodb:// or mongodb+srv://",
      ),

    AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters (generate a real one, don't guess)"),

    EMAIL_TRANSPORT: z.enum(["console", "resend"]).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),

    // Never trusted from the request itself — see app-origin.ts's own comment.
    APP_ORIGIN: z.string().url("APP_ORIGIN must be a full URL, e.g. https://formora-web.vercel.app").optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    // Mirrors the exact rule email.ts always enforced: an explicit value (either
    // one) is always honoured regardless of environment; only a *missing* value
    // in production is an error. A local `pnpm build` runs with NODE_ENV=production
    // internally but keeps working as long as .env.local sets EMAIL_TRANSPORT=console.
    if (!env.EMAIL_TRANSPORT && env.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_TRANSPORT"],
        message: "EMAIL_TRANSPORT must be set to 'resend' or 'console' in production.",
      });
    }
    if (env.EMAIL_TRANSPORT === "resend") {
      if (!env.RESEND_API_KEY) {
        ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Required when EMAIL_TRANSPORT=resend." });
      }
      if (!env.EMAIL_FROM) {
        ctx.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Required when EMAIL_TRANSPORT=resend." });
      }
    }
    // One Google var without the other is almost always a mistake (a typo'd
    // name, a half-finished paste) rather than an intentional choice — the
    // intentional way to disable Google sign-in is to set neither.
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message:
          "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither. One alone silently disables Google sign-in instead of failing loudly, so it's rejected here.",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(
      `Invalid environment configuration:\n${lines.join("\n")}\n\nSee apps/web/.env.example for the full list.`,
    );
  }
  cached = parsed.data;
  return cached;
}

export function isGoogleConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
