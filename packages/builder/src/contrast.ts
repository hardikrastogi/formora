function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [channel(r), channel(g), channel(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG contrast ratio between a hex colour and white text, or null if the colour can't be parsed. */
export function contrastAgainstWhite(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const l1 = relativeLuminance(rgb);
  const l2 = 1;
  return (l2 + 0.05) / (l1 + 0.05);
}

export const WCAG_AA_NORMAL_TEXT = 4.5;
