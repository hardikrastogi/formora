import { NextResponse } from "next/server";
import { consumeAccountToken } from "@/lib/auth/account-tokens";
import { hashPassword, isValidPassword } from "@/lib/auth/password";
import { setUserPassword } from "@/lib/auth/users";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { token, password } = (body as { token?: unknown; password?: unknown } | null) ?? {};
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "Choose a password with at least 8 characters." }, { status: 422 });
  }

  const consumed = await consumeAccountToken("reset", token);
  if (!consumed) {
    return NextResponse.json({ error: "This link has expired or was already used." }, { status: 410 });
  }

  await setUserPassword(consumed.email, await hashPassword(password));
  return NextResponse.json({ ok: true }, { status: 200 });
}
