"use client";

import { useEffect, useState } from "react";

import { JellyNav, type NavLink } from "./jelly-nav";
import { MobileNavMenu } from "./mobile-nav-menu";

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

  if (!email) {
    return <JellyNav items={[{ href: "/signin", label: "Log in" }, { href: "/signup", label: "Sign up" }]} />;
  }

  const menuLinks: NavLink[] = [
    { href: "/dashboard", label: "My forms" },
    { href: "/my-responses", label: "Your responses" },
    { href: "/account", label: "Account" },
  ];
  const signOutLink: NavLink = { href: "/signout", label: "Sign out" };

  return (
    <>
      {/* Full pill nav once there's room for all four items. */}
      <div className="hidden md:block">
        <JellyNav items={[...menuLinks, signOutLink]} />
      </div>
      {/* Below that, only "Sign out" stays on the bar; the rest move into
          the hamburger sidebar — the four-item pill group doesn't fit next
          to the dark-mode toggle on a phone screen. */}
      <div className="flex items-center gap-2 md:hidden">
        <MobileNavMenu links={menuLinks} />
        <JellyNav items={[signOutLink]} />
      </div>
    </>
  );
}
