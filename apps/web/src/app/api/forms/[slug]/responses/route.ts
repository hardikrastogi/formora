import { NextResponse } from "next/server";
import { FormDefinitionSchema } from "@hardikrastogi/core";
import { getUserId } from "@/lib/auth/session";
import { getOwnedForm } from "@/lib/db/owned-form";
import { listResponses, RESPONSES_DEFAULT_LIMIT } from "@/lib/db/responses";
import { FormVersionModel } from "@/lib/db/models/FormVersion";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { slug } = await context.params;
  // A form that exists but belongs to someone else looks exactly like a
  // missing one — same rule as publish/unpublish, so a slug can't be probed.
  const form = await getOwnedForm(slug, userId);
  if (!form) return NextResponse.json({ error: "No form found for this slug." }, { status: 404 });

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const sortParam = url.searchParams.get("sort");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const from = fromParam ? new Date(fromParam) : null;
  if (from && Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: "'from' must be a valid date." }, { status: 400 });
  }
  const to = toParam ? new Date(toParam) : null;
  if (to && Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "'to' must be a valid date." }, { status: 400 });
  }

  const offsetParam = url.searchParams.get("offset");
  const offset = offsetParam ? Number(offsetParam) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    return NextResponse.json({ error: "'offset' must be a non-negative integer." }, { status: 400 });
  }

  const result = await listResponses({
    formId: form._id,
    offset,
    limit: limitParam ? Number(limitParam) : RESPONSES_DEFAULT_LIMIT,
    search: url.searchParams.get("search"),
    sort: sortParam === "asc" ? "asc" : "desc",
    from,
    to,
  });

  // The current form's fields, once, so the UI can render column headers —
  // not fetched per row. A response answered against an older version can
  // still have fields this list doesn't know about; the detail view resolves
  // labels against that specific response's own version instead.
  let fields: { id: string; label: string; type: string }[] = [];
  if (form.currentVersionId) {
    const version = await FormVersionModel.findById(form.currentVersionId).lean<{ definition?: unknown } | null>();
    const parsed = FormDefinitionSchema.safeParse(version?.definition);
    if (parsed.success) {
      fields = parsed.data.fields.map((f) => ({ id: f.id, label: f.label, type: f.type }));
    }
  }

  return NextResponse.json(
    {
      fields,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      responses: result.rows.map((r) => ({
        id: String(r._id),
        submittedAt: r.submittedAt,
        updatedAt: (r as unknown as { updatedAt: Date }).updatedAt,
        revisionNumber: r.revisionNumber,
        verified: Boolean(r.respondentIdentityId),
        answers: r.answers,
      })),
    },
    { status: 200 },
  );
}
