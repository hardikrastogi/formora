import { NextResponse } from "next/server";
import { RateLimitedError, requestAccountToken } from "@/lib/auth/account-tokens";
import { findUserByEmail } from "@/lib/auth/users";
import { normalizeEmail } from "@/lib/respondent-verification";

/**
 * Always answers 200, whether or not the address has a password (or exists
 * at all) — the same anti-enumeration rule as everywhere else a stranger can
 * type in an arbitrary email address.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const email = normalizeEmail((body as { email?: unknown } | null)?.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 });

  const user = await findUserByEmail(email);
  if (user?.passwordHash) {
    try {
      await requestAccountToken("reset", email, request);
    } catch (error) {
      if (error instanceof RateLimitedError) {
        return NextResponse.json(
          { error: error.message },
          { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
        );
      }
      throw error;
    }
  }
  // No account, or a Google/magic-link-only account with no password: stay silent.

  return NextResponse.json({ ok: true }, { status: 200 });
}
