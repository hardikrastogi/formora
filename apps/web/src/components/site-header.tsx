import Link from "next/link";
import { AuthNav } from "./auth-nav";

// Docs and Playground are developer-facing pages — a different audience
// from form creators — so they stay live at their own URLs but are left out
// of the main nav. The npm package link that used to sit here was dropped
// outright (not relocated) as low-value clutter for the hosted-product
// audience the nav is actually written for now. "Builder" was dropped too:
// it only ever redirected to /dashboard, which AuthNav's "My forms" link
// already covers.

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Formora
        </Link>
        <nav aria-label="Main" className="flex items-center gap-5 text-sm">
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
