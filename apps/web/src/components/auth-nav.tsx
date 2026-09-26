"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Fetched in the browser rather than read on the server so the header doesn't
// force every page (docs included) to render per request instead of being static.
export function AuthNav() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (!cancelled) setEmail(session?.user?.email ?? null);
      })
      .catch(() => {
        if (!cancelled) setEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (email === undefined) return null;
  return email ? (
    <>
      <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
        My forms
      </Link>
      <Link href="/signout" className="text-muted-foreground hover:text-foreground">
        Sign out
      </Link>
    </>
  ) : (
    <Link href="/signin" className="text-muted-foreground hover:text-foreground">
      Sign in
    </Link>
  );
}
