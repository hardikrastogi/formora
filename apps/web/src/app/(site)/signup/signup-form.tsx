"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SignupForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/account/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not sign up. Please try again.");
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign up. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-md border p-4">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Open the link we sent to {email.trim().toLowerCase()} to finish creating your account. It works once and
          expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} aria-label="Sign up" className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="signup-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="signup-confirm" className="block text-sm font-medium">
          Confirm password
        </label>
        <input
          id="signup-confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Sign up"}
      </Button>
    </form>
  );
}
