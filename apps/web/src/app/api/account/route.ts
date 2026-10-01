import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";
import { hasGoogleLinked } from "@/lib/auth/linked-accounts";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  return NextResponse.json({
    email: user.email,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: await hasGoogleLinked(userId),
  });
}
