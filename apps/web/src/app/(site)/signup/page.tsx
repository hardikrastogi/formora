import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { GoogleButton } from "@/components/google-button";
import { isGoogleConfigured } from "@/lib/env";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignUpPage({
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
      <h1 className="text-2xl font-bold tracking-tight">Create your Formora account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Build and publish forms, and manage the ones you own. Your account is only for creating forms — anyone with a
        link can still fill one out without signing up.
      </p>

      {googleEnabled ? (
        <div className="mt-6">
          <GoogleButton next={next} label="Sign up with Google" />
        </div>
      ) : null}

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <SignupForm next={next} />

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/signin?next=${encodeURIComponent(next)}`} className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
