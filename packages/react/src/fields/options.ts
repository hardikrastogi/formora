export interface Option {
  label: string;
  value: string;
}

export function normalizeOptions(raw: unknown): Option[] {
  if (!Array.isArray(raw)) return [];
  const options: Option[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      options.push({ label: item, value: item });
    } else if (
      item &&
      typeof item === "object" &&
      typeof (item as Option).value === "string" &&
      typeof (item as Option).label === "string"
    ) {
      options.push({ label: (item as Option).label, value: (item as Option).value });
    }
  }
  return options;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
