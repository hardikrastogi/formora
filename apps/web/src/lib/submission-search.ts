/**
 * A lowercased, space-joined copy of every string/number/boolean answer
 * value, recomputed on every submit and edit. Backs the response
 * dashboard's search box as a plain substring match over one field — not a
 * real search engine, but proportionate to how few responses one form
 * realistically has.
 */
export function computeSearchText(answers: Record<string, unknown>): string {
  return Object.values(answers)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .map((value) => String(value).toLowerCase())
    .join(" ")
    .slice(0, 5000); // guards against a pathologically large answer set inflating the index
}
