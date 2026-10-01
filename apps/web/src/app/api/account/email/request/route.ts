import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { RateLimitedError, requestAccountToken } from "@/lib/auth/account-tokens";
import { findUserByEmail, findUserById } from "@/lib/auth/users";
import { normalizeEmail } from "@/lib/respondent-verification";

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const newEmail = normalizeEmail((body as { newEmail?: unknown } | null)?.newEmail);
  if (!newEmail) return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 });

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (newEmail === user.email) {
    return NextResponse.json({ error: "That's already your email address." }, { status: 422 });
  }
  const existing = await findUserByEmail(newEmail);
  if (existing) {
    return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
  }

  try {
    await requestAccountToken("change-email", newEmail, request, { userId });
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
