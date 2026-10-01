import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { GoogleButton } from "@/components/google-button";
import { isGoogleConfigured } from "@/lib/env";
import { PasswordLoginForm } from "./password-login-form";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Log in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next ?? params.callbackUrl);
  if (await auth()) redirect(next);
  const googleEnabled = isGoogleConfigured();

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Log in to Formora</h1>

      {googleEnabled ? (
        <div className="mt-6">
          <GoogleButton next={next} label="Continue with Google" />
        </div>
      ) : null}

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <PasswordLoginForm next={next} />
      <p className="mt-3 text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline">
          Forgot password?
        </Link>
      </p>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <p className="text-sm text-muted-foreground">No password to remember: get a one-time link by email instead.</p>
      <SignInForm next={next} />

      <p className="mt-6 text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
