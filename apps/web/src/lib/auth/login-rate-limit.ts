import { headers } from "next/headers";
import { connectToDatabase } from "@/lib/db/connect";
import { LoginAttemptModel } from "@/lib/db/models/LoginAttempt";
import { hashIp } from "@/lib/respondent-session";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;

export interface LoginRateLimitResult {
  blocked: boolean;
  retryAfterSeconds: number;
}

/** Same fallback and header as respondent-verification.ts's clientIp, adapted for a server action (no Request object). */
async function currentIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Checked before every password login attempt. Blocks on either a burst of
 * failures against one email (credential stuffing one target) or a burst
 * from one network address across any emails (distributed guessing) — a
 * fixed lockout window, not exponential backoff, matching the rate-limit
 * style already used for 5c's and 5b-2's email-sending endpoints.
 */
export async function checkLoginRateLimit(email: string): Promise<LoginRateLimitResult> {
  await connectToDatabase();
  const ip = await currentIp();
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - WINDOW_MS);

  const [byEmail, byIp] = await Promise.all([
    LoginAttemptModel.countDocuments({ email, createdAt: { $gt: since } }),
    LoginAttemptModel.countDocuments({ ipHash, createdAt: { $gt: since } }),
  ]);

  if (byEmail >= MAX_ATTEMPTS_PER_EMAIL || byIp >= MAX_ATTEMPTS_PER_IP) {
    return { blocked: true, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

/** Called only on a failed login — a correct password never adds to the count. */
export async function recordFailedLogin(email: string): Promise<void> {
  await connectToDatabase();
  const ipHash = hashIp(await currentIp());
  await LoginAttemptModel.create({ email, ipHash });
}
