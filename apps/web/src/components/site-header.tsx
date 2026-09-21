import Link from "next/link";

const links = [
  { href: "/docs", label: "Docs" },
  { href: "/playground", label: "Playground" },
  { href: "https://www.npmjs.com/package/@hardikrastogi/react", label: "npm", external: true },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Formora
        </Link>
        <nav aria-label="Main" className="flex items-center gap-5 text-sm">
          {links.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
                {l.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
