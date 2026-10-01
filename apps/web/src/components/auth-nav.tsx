"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
}

/**
 * A pure-CSS port of React Bits' Pill Nav — the original uses GSAP to rise a
 * circle from the bottom of a hovered pill and swap in an inverted-colour
 * label; reproduced here with CSS transitions instead, since it's a two-state
 * hover animation (on/off), not a choreographed timeline, so a library buys
 * nothing. The current route gets the small dot the original uses to mark
 * the active item, not a filled pill.
 */
function PillLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <div className="pill-nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="pill-nav-item" aria-current={l.href === pathname ? "page" : undefined}>
          <span className="hover-circle" aria-hidden="true" />
          <span className="label-stack">
            <span className="pill-label">{l.label}</span>
            <span className="pill-label-hover" aria-hidden="true">
              {l.label}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

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

  return <PillLinks links={links} />;
}
