"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
      const res = await fetch("/api/account/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "This link is not valid.");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This link is not valid.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="mt-6 rounded-md border p-4">
        <p className="font-medium">Your password has been changed.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          <Link href="/signin" className="underline">
            Log in
          </Link>{" "}
          with your new password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <div>
        <label htmlFor="reset-password" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="reset-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="reset-confirm" className="block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="reset-confirm"
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
          {error}{" "}
          <Link href="/forgot-password" className="underline">
            Ask for a new link
          </Link>
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
