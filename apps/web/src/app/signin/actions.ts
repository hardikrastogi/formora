"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";

export interface SignInState {
  error: string | null;
}

export async function requestLink(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeRedirectPath(formData.get("next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  try {
    // On success signIn redirects (by throwing), so nothing after it runs.
    await signIn("email", { email, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "We couldn't send the sign-in link. Please try again in a moment." };
    }
    throw error;
  }
  return { error: null };
}
