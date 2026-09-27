import { createHash, randomBytes } from "node:crypto";

export const VERIFICATION_LINK_MINUTES = 15;
/** Minimum gap between two emails to the same address for the same form. */
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_LINKS_PER_EMAIL_PER_HOUR = 5;
export const MAX_LINKS_PER_IP_PER_HOUR = 20;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  // 254 is the longest address email standards allow.
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/** 256 random bits: guessing a valid link is not feasible, so no attempt counter is needed. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
