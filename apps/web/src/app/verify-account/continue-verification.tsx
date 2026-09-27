"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ContinueVerification({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function confirm() {
    setState("pending");
    setError(null);
    try {
      const res = await fetch("/api/account/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "This link is not valid.");
      setEmail(body.email ?? null);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This link is not valid.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="mt-6 rounded-md border p-4">
        <p className="font-medium">Your email is verified{email ? ` (${email})` : ""}.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          <Link href="/signin" className="underline">
            Log in
          </Link>{" "}
          with the password you chose.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Button type="button" onClick={confirm} disabled={state === "pending"}>
        {state === "pending" ? "Verifying…" : "Continue"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <Link href="/signup" className="underline">
            Sign up again
          </Link>
        </p>
      ) : null}
    </div>
  );
}
