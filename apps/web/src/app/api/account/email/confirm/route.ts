import { NextResponse } from "next/server";
import { consumeAccountToken } from "@/lib/auth/account-tokens";
import { findUserByEmail, setUserEmail } from "@/lib/auth/users";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { token } = (body as { token?: unknown } | null) ?? {};
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
  }

  const consumed = await consumeAccountToken("change-email", token);
  if (!consumed || !consumed.userId) {
    return NextResponse.json({ error: "This link has expired or was already used." }, { status: 410 });
  }

  // Re-check at confirm time: someone else could have taken the address
  // during the minutes the link sat unopened in an inbox.
  const existing = await findUserByEmail(consumed.email);
  if (existing) {
    return NextResponse.json({ error: "That email address is now in use by another account." }, { status: 409 });
  }

  await setUserEmail(consumed.userId, consumed.email);
  return NextResponse.json({ ok: true, email: consumed.email }, { status: 200 });
}
