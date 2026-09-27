"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "sending" | "sent";

export function VerifyGate({ slug }: { slug: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function requestLink(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(slug)}/verify/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "We couldn't send the link. Please try again.");
      }
      setStatus("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't send the link. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-md border p-4">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          If {email.trim().toLowerCase()} can receive mail, a link is on its way. It works once and expires in 15
          minutes. Open it and choose Continue to form.
        </p>
        <button
          type="button"
          className="mt-3 text-sm underline"
          onClick={() => {
            setStatus("idle");
          }}
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={requestLink} className="space-y-3 rounded-md border p-4">
      <p className="text-sm text-muted-foreground">
        The person who shared this form asks you to verify your email address before answering. We&apos;ll send you a
        link; there is no account to create.
      </p>
      <label htmlFor="respondent-email" className="block text-sm font-medium">
        Your email address
      </label>
      <input
        id="respondent-email"
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
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Email me a link"}
      </Button>
    </form>
  );
}
