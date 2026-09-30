"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { checkLoginRateLimit, recordFailedLogin } from "@/lib/auth/login-rate-limit";

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

export async function loginWithPassword(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("next"));
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  // Checked (and recorded) whether or not this email has an account — a
  // nonexistent email must lock out identically to a real one, or the two
  // become distinguishable purely by which ones eventually get blocked.
  const limit = await checkLoginRateLimit(email);
  if (limit.blocked) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  try {
    // On success signIn redirects (by throwing), so nothing after it runs.
    await signIn("credentials", { email, password, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) {
      await recordFailedLogin(email);
      return { error: "Incorrect email or password." };
    }
    throw error;
  }
  return { error: null };
}
