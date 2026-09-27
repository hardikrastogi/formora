import { NextResponse } from "next/server";
import { consumeAccountToken } from "@/lib/auth/account-tokens";
import { upsertVerifiedPasswordUser } from "@/lib/auth/users";

/**
 * The "Continue" button on the emailed signup link. A GET from a mail
 * scanner opening the link never reaches here — see /verify-account/page.tsx.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const token = (body as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
  }

  const consumed = await consumeAccountToken("signup", token);
  if (!consumed || !consumed.pendingPasswordHash) {
    return NextResponse.json({ error: "This link has expired or was already used." }, { status: 410 });
  }

  await upsertVerifiedPasswordUser(consumed.email, consumed.pendingPasswordHash);
  return NextResponse.json({ ok: true, email: consumed.email }, { status: 200 });
}
