"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Docs" className="flex flex-wrap gap-2 text-sm md:flex-col md:gap-1">
      {DOCS_NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 hover:bg-muted",
              active ? "bg-muted font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
