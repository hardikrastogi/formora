"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AccountInfo {
  email: string;
  hasPassword: boolean;
  hasGoogle: boolean;
}

export function AccountSettings({
  googleAvailable,
  googleButton,
}: {
  googleAvailable: boolean;
  googleButton: ReactNode;
}) {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load your account.");
        return res.json();
      })
      .then((data: AccountInfo) => {
        if (!cancelled) setInfo(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load your account.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <p role="alert" className="mt-6 text-sm text-destructive">
        {loadError}
      </p>
    );
  }
  if (!info) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mt-6 space-y-8">
      <EmailSection currentEmail={info.email} />
      <PasswordSection
        hasPassword={info.hasPassword}
        onRemoved={() => setInfo((prev) => (prev ? { ...prev, hasPassword: false } : prev))}
      />
      {googleAvailable || info.hasGoogle ? (
        <GoogleSection
          hasGoogle={info.hasGoogle}
          googleButton={googleButton}
          onDisconnected={() => setInfo((prev) => (prev ? { ...prev, hasGoogle: false } : prev))}
        />
      ) : null}
    </div>
  );
}

function EmailSection({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/account/email/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start the email change.");
      }
      setSentTo(newEmail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the email change.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Email</h2>
      <p className="mt-2 text-sm">
        Current: <strong>{currentEmail}</strong>
      </p>
      {sentTo ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Check <strong>{sentTo}</strong> for a confirmation link. Your email won&apos;t change until you click it.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="new-email" className="block text-sm font-medium">
              New email address
            </label>
            <input
              id="new-email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mt-1 w-64 rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Change email"}
          </Button>
        </form>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function PasswordSection({ hasPassword, onRemoved }: { hasPassword: boolean; onRemoved: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRemove() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/account/password/remove", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not remove your password.");
      }
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove your password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Password</h2>
      {hasPassword ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link href="/forgot-password" className="text-sm underline">
            Change password
          </Link>
          <Button type="button" variant="outline" onClick={onRemove} disabled={pending}>
            {pending ? "Removing…" : "Remove password"}
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No password set.{" "}
          <Link href="/signup" className="underline">
            Add one
          </Link>{" "}
          — using the same email keeps this account, it won&apos;t create a new one.
        </p>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function GoogleSection({
  hasGoogle,
  googleButton,
  onDisconnected,
}: {
  hasGoogle: boolean;
  googleButton: ReactNode;
  onDisconnected: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDisconnect() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/account/google/disconnect", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not disconnect Google.");
      }
      onDisconnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect Google.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Google</h2>
      {hasGoogle ? (
        <div className="mt-3">
          <Button type="button" variant="outline" onClick={onDisconnect} disabled={pending}>
            {pending ? "Disconnecting…" : "Disconnect Google"}
          </Button>
        </div>
      ) : (
        <div className="mt-3 max-w-[12rem]">{googleButton}</div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
