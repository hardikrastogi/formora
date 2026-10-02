"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { NavLink } from "./jelly-nav";
import "./mobile-nav-menu.css";

/**
 * The hamburger-opened sidebar that holds "My forms" / "Your responses" /
 * "Account" on narrow screens, where the full JellyNav pill group no longer
 * fits next to the dark-mode toggle. "Sign out" stays directly visible in
 * the header (rendered separately by auth-nav.tsx) rather than living in
 * here, per the request that only the sign option stay on the main bar.
 */
export function MobileNavMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="mobile-nav-trigger"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div className="mobile-nav-backdrop" onClick={() => setOpen(false)}>
              <nav
                aria-label="Main"
                role="dialog"
                aria-modal="true"
                className="mobile-nav-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <button type="button" className="mobile-nav-close" aria-label="Close menu" onClick={() => setOpen(false)}>
                  <X size={20} aria-hidden="true" />
                </button>
                <ul className="mobile-nav-list">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={l.href === pathname ? "page" : undefined}
                        onClick={() => setOpen(false)}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
