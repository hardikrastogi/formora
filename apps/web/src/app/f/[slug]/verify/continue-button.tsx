"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ContinueButton({ slug, token }: { slug: string; token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(slug)}/verify/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "This link is not valid.");
      }
      router.push(`/f/${encodeURIComponent(slug)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This link is not valid.");
      setPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <Button type="button" onClick={confirm} disabled={pending}>
        {pending ? "Opening…" : "Continue to form"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <Link href={`/f/${encodeURIComponent(slug)}`} className="underline">
            Ask for a new link
          </Link>
        </p>
      ) : null}
    </div>
  );
}
