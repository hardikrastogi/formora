import type { CSSProperties } from "react";
import type { FieldStyle, Theme } from "@hardikrastogi/core";

const RADIUS = { none: "0", sm: "4px", md: "8px", lg: "12px", full: "9999px" } as const;
const GAP = { compact: "0.5rem", comfortable: "1rem", spacious: "1.5rem" } as const;

type CssVars = CSSProperties & Record<`--${string}`, string | number>;

function safeFontName(font: string): string | undefined {
  const cleaned = font.replace(/[^A-Za-z0-9 \-]/g, "").trim();
  return cleaned ? `'${cleaned}', system-ui, sans-serif` : undefined;
}

export function themeToCssVars(theme: Theme | undefined): CSSProperties {
  const vars: CssVars = {};
  if (!theme) return vars;
  if (theme.colors?.primary) vars["--df-primary"] = theme.colors.primary;
  if (theme.colors?.background) vars["--df-bg"] = theme.colors.background;
  if (theme.colors?.text) vars["--df-text"] = theme.colors.text;
  if (theme.radius) vars["--df-radius"] = RADIUS[theme.radius];
  if (theme.density) vars["--df-gap"] = GAP[theme.density];
  if (theme.font) {
    const font = safeFontName(theme.font);
    if (font) vars["--df-font"] = font;
  }
  return vars;
}

export function fieldStyleToCssVars(style: FieldStyle | undefined, span: number): CSSProperties {
  const vars: CssVars = { "--df-span": span };
  if (!style) return vars;
  if (style.textColor) vars["--df-field-text"] = style.textColor;
  if (style.backgroundColor) vars["--df-field-bg"] = style.backgroundColor;
  if (style.borderColor) vars["--df-field-border"] = style.borderColor;
  if (style.radius) vars["--df-field-radius"] = RADIUS[style.radius];
  if (style.fontSize) vars["--df-field-font-size"] = style.fontSize;
  return vars;
}
