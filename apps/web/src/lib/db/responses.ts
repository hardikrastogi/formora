import { SubmissionModel, type SubmissionDoc } from "@/lib/db/models/Submission";

export const RESPONSES_DEFAULT_LIMIT = 20;
export const RESPONSES_MAX_LIMIT = 100;

export type SubmissionRow = SubmissionDoc & { _id: unknown };

export interface ListResponsesOptions {
  formId: unknown;
  offset?: number;
  limit?: number;
  search?: string | null;
  sort?: "asc" | "desc";
  from?: Date | null;
  to?: Date | null;
}

export interface ListResponsesResult {
  rows: SubmissionRow[];
  hasMore: boolean;
  totalCount: number;
}

// A literal string used inside a $regex must have its own regex metacharacters
// escaped, or a search for e.g. "a.b" would match far more than intended.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Offset-paginated. Sorted by submittedAt with `_id` as a tiebreaker (see
 * Submission's own compound index), so ties on the same millisecond still
 * sort consistently. Like any offset-based listing, a response submitted
 * while someone is paging through can shift later pages by one; that's an
 * accepted tradeoff for the plain limit/offset + hasMore shape here.
 */
export async function listResponses(options: ListResponsesOptions): Promise<ListResponsesResult> {
  const limit = Math.min(Math.max(options.limit ?? RESPONSES_DEFAULT_LIMIT, 1), RESPONSES_MAX_LIMIT);
  const offset = Math.max(options.offset ?? 0, 0);
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

  const [rows, totalCount] = await Promise.all([
    SubmissionModel.find(filter)
      .sort({ submittedAt: descending ? -1 : 1, _id: descending ? -1 : 1 })
      .skip(offset)
      .limit(limit + 1)
      .lean<SubmissionRow[]>(),
    SubmissionModel.countDocuments(filter),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page, hasMore, totalCount };
}
