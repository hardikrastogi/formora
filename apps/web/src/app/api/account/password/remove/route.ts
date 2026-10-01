import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { clearUserPassword, findUserById } from "@/lib/auth/users";

// No "do you have another sign-in method" guard needed: every account can
// always fall back to an emailed magic link, regardless of password or
// Google — that provider is registered unconditionally in auth.ts.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!user.passwordHash) return NextResponse.json({ error: "You don't have a password set." }, { status: 422 });

  await clearUserPassword(userId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
