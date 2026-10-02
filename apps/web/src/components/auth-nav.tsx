"use client";

import { useEffect, useState } from "react";

import { JellyNav, type NavLink } from "./jelly-nav";

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

  const links: NavLink[] = email
    ? [
        { href: "/dashboard", label: "My forms" },
        { href: "/my-responses", label: "Your responses" },
        { href: "/account", label: "Account" },
        { href: "/signout", label: "Sign out" },
      ]
    : [
        { href: "/signin", label: "Log in" },
        { href: "/signup", label: "Sign up" },
      ];

  return <JellyNav items={links} />;
}
