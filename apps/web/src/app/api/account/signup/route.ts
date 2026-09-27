import { NextResponse } from "next/server";
import { RateLimitedError, requestAccountToken } from "@/lib/auth/account-tokens";
import { findUserByEmail } from "@/lib/auth/users";
import { hashPassword, isValidPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/respondent-verification";

/**
 * Starts a password signup. Never reveals whether the address is already
 * registered with a password: the response is the same either way, and only
 * the emailed link (or its absence, for an address that already has one)
 * tells the real story.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { email: rawEmail, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 });
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "Choose a password with at least 8 characters." }, { status: 422 });
  }

  const existing = await findUserByEmail(email);
  if (existing?.passwordHash) {
    // A real account already has a password: say so plainly, rather than
    // silently emailing a link that would just fail — there's nothing secret
    // to protect here since knowing "this email already has a password" is
    // no more revealing than the login page saying "wrong password" would be.
    return NextResponse.json(
      { error: "An account with this email already exists. Log in instead." },
      { status: 409 },
    );
  }

  try {
    await requestAccountToken("signup", email, request, { pendingPasswordHash: await hashPassword(password) });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
