import type { Metadata } from "next";
import { ContinueVerification } from "./continue-verification";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Loading this page must NOT use up the token (mail scanners open links
// automatically) — only pressing the button does, exactly like 5c's
// /f/[slug]/verify page.
export default async function VerifyAccountPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Continue to finish creating your account.
      </p>
      <ContinueVerification token={typeof token === "string" ? token : ""} />
    </div>
  );
}
