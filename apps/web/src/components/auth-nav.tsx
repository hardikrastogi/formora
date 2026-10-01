"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
}

/**
 * A pill-shaped nav with a sliding indicator behind the current page's link
 * (inspired by React Bits' Pill Nav) — hand-built with plain React state and
 * getBoundingClientRect, no animation library: the indicator only has to
 * reposition on navigation, not track the mouse, so a library buys nothing
 * here. The indicator tracks the *current route*, not hover; hover gets its
 * own lightweight background via CSS alone.
 */
function PillLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const activeHref = links.find((l) => l.href === pathname)?.href ?? null;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = activeHref ? itemRefs.current.get(activeHref) : undefined;
    if (!container || !el) {
      setIndicator(null);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({ left: elRect.left - containerRect.left, width: elRect.width });
  }, [activeHref, links]);

  return (
    <div ref={containerRef} className="pill-nav">
      {indicator ? (
        <span
          aria-hidden="true"
          className="pill-nav-indicator"
          style={{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }}
        />
      ) : null}
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          ref={(el) => {
            if (el) itemRefs.current.set(l.href, el);
            else itemRefs.current.delete(l.href);
          }}
          className="pill-nav-item"
          aria-current={l.href === pathname ? "page" : undefined}
        >
          {l.label}
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
