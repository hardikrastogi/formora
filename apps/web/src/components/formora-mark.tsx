/**
 * The approved "Concept A" monogram — a bold geometric F in a rounded-square
 * badge. Drawn as plain rects, not a text glyph: a favicon/app-icon gets
 * rasterized without guaranteed access to a loaded web font, and the shape
 * needs to stay pixel-identical everywhere it's used (header, favicon, any
 * future app icon), not depend on Archivo having loaded. Colors are fixed
 * (ink badge, cream F) rather than theme-aware — a brand mark reads as one
 * fixed chip against either page background, the same way most product
 * logos don't invert with light/dark mode.
 */
export function FormoraMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="Formora"
      className={className}
    >
      <rect width="100" height="100" rx="22" fill="#1C1A16" />
      <rect x="30" y="24" width="14" height="52" rx="4" fill="#F8F5F0" />
      <rect x="30" y="24" width="40" height="14" rx="4" fill="#F8F5F0" />
      <rect x="30" y="46" width="30" height="14" rx="4" fill="#F8F5F0" />
    </svg>
  );
}
