"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="mt-6 rounded-md border p-4">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          If {email.trim().toLowerCase()} has a password set, a reset link is on its way. It works once and expires
          in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label htmlFor="forgot-email" className="block text-sm font-medium">
        Email address
      </label>
      <input
        id="forgot-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
