"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function confirm() {
    setState("pending");
    setError(null);
    try {
      const res = await fetch("/api/account/email/confirm", {
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
        <p className="font-medium">Your email is now {email ?? "updated"}.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          <Link href="/account" className="underline">
            Back to account settings
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Button type="button" onClick={confirm} disabled={state === "pending"}>
        {state === "pending" ? "Confirming…" : "Confirm email change"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <Link href="/account" className="underline">
            Back to account settings
          </Link>
        </p>
      ) : null}
    </div>
  );
}
