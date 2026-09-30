import { SubmissionModel, type SubmissionDoc } from "@/lib/db/models/Submission";

export const RESPONSES_DEFAULT_LIMIT = 20;
export const RESPONSES_MAX_LIMIT = 100;

export type SubmissionRow = SubmissionDoc & { _id: unknown };

export interface ListResponsesOptions {
  formId: unknown;
  cursor?: string | null;
  limit?: number;
  search?: string | null;
  sort?: "asc" | "desc";
  from?: Date | null;
  to?: Date | null;
}

export interface ListResponsesResult {
  rows: SubmissionRow[];
  nextCursor: string | null;
  totalCount: number;
}

interface Cursor {
  t: string; // submittedAt, ISO
  i: string; // _id
}

function encodeCursor(row: SubmissionRow): string {
  const cursor: Cursor = { t: new Date((row as { submittedAt: Date }).submittedAt).toISOString(), i: String(row._id) };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Cursor>;
    if (typeof parsed.t === "string" && typeof parsed.i === "string") return { t: parsed.t, i: parsed.i };
  } catch {
    // fall through
  }
  return null;
}

// A literal string used inside a $regex must have its own regex metacharacters
// escaped, or a search for e.g. "a.b" would match far more than intended.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cursor-paginated, never loading a whole form's responses into memory at
 * once. Sorted by submittedAt with `_id` as a tiebreaker (see Submission's
 * own compound index), so pagination stays stable even if two responses
 * land in the same millisecond, and even while other responses keep
 * arriving on later pages.
 */
export async function listResponses(options: ListResponsesOptions): Promise<ListResponsesResult> {
  const limit = Math.min(Math.max(options.limit ?? RESPONSES_DEFAULT_LIMIT, 1), RESPONSES_MAX_LIMIT);
  const descending = options.sort !== "asc";

  const filter: Record<string, unknown> = { formId: options.formId };
  if (options.search) {
    filter.searchText = { $regex: escapeRegex(options.search.toLowerCase()), $options: "i" };
  }
  if (options.from || options.to) {
    const range: Record<string, Date> = {};
    if (options.from) range.$gte = options.from;
    if (options.to) range.$lte = options.to;
    filter.submittedAt = range;
  }

  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (decoded) {
      const cursorDate = new Date(decoded.t);
      const cmp = descending ? "$lt" : "$gt";
      // Same timestamp, smaller/larger _id — or a strictly earlier/later timestamp.
      filter.$or = [
        { submittedAt: { [cmp]: cursorDate } },
        { submittedAt: cursorDate, _id: { [cmp]: decoded.i } },
      ];
    }
  }

  const [rows, totalCount] = await Promise.all([
    SubmissionModel.find(filter)
      .sort({ submittedAt: descending ? -1 : 1, _id: descending ? -1 : 1 })
      .limit(limit + 1)
      .lean<SubmissionRow[]>(),
    SubmissionModel.countDocuments({
      formId: options.formId,
      ...(filter.searchText ? { searchText: filter.searchText } : {}),
      ...(filter.submittedAt ? { submittedAt: filter.submittedAt } : {}),
    }),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    rows: page,
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    totalCount,
  };
}
