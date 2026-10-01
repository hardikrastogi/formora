"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

// No next-themes in this app (the site has no dark-mode toggle yet), so this
// always renders in the "system" look — matches .dark class support already
// wired up in globals.css without adding a new dependency just for this.
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
