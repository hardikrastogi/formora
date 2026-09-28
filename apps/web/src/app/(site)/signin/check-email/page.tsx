import type { Metadata } from "next";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent you a sign-in link. It works once and expires in 15 minutes. You can close this tab; the link opens
        Formora and signs you in.
      </p>
    </div>
  );
}
