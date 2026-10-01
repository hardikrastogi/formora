import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { disconnectGoogle } from "@/lib/auth/linked-accounts";

// No "do you have a password" guard needed: every account can always fall
// back to an emailed magic link, regardless of password or Google.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const removed = await disconnectGoogle(userId);
  if (!removed) return NextResponse.json({ error: "Google isn't connected to your account." }, { status: 422 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
