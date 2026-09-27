/**
 * The public address of this app, used to build links inside emails.
 *
 * It must NOT come from the incoming request's Host header: an attacker could
 * request a verification email for someone else with a forged Host, and the
 * victim would receive a link to the attacker's site carrying a live token.
 * So it comes from configuration:
 *   APP_ORIGIN                       explicit (set this for local e2e and custom domains)
 *   VERCEL_PROJECT_PRODUCTION_URL    provided by Vercel automatically
 * In development only, it falls back to the request's own origin.
 */
export function appOrigin(request: Request): string {
  const explicit = process.env.APP_ORIGIN;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  throw new Error("APP_ORIGIN must be set in production (for example https://formora-web.vercel.app).");
}
