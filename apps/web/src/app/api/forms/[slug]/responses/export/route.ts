import { FormDefinitionSchema } from "@hardikrastogi/core";
import { getUserId } from "@/lib/auth/session";
import { getOwnedForm } from "@/lib/db/owned-form";
import { SubmissionModel } from "@/lib/db/models/Submission";
import { FormVersionModel } from "@/lib/db/models/FormVersion";

const BATCH_SIZE = 500;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  // Quote whenever needed (comma, quote, or newline present); double any embedded quotes.
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Streams a CSV rather than building the whole file in memory first, so
 * memory use stays bounded regardless of how many responses a form has.
 * This is a synchronous download, not a background job — a genuinely huge
 * export (beyond what a single request can finish inside Vercel's function
 * time limit) would need real async job infrastructure, deliberately not
 * built yet; see ROADMAP.md's own note on not building for a problem that
 * doesn't exist yet, same reasoning as the deferred Redis rate-limit item.
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const userId = await getUserId();
  if (!userId) return new Response("Sign in required.", { status: 401 });

  const { slug } = await context.params;
  const form = await getOwnedForm(slug, userId);
  if (!form) return new Response("No form found for this slug.", { status: 404 });

  let fields: { id: string; label: string }[] = [];
  if (form.currentVersionId) {
    const version = await FormVersionModel.findById(form.currentVersionId).lean<{ definition?: unknown } | null>();
    const parsed = FormDefinitionSchema.safeParse(version?.definition);
    if (parsed.success) fields = parsed.data.fields.map((f) => ({ id: f.id, label: f.label }));
  }
  const fieldIds = new Set(fields.map((f) => f.id));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Fixed columns first (current form fields, in their own order), then
      // any answer keys from older versions that no longer exist on the
      // current form — so nothing a respondent actually answered is silently
      // dropped just because the form changed since.
      const extraKeys = new Set<string>();
      let lastId: unknown = null;
      // A first pass just to discover extra keys, in fixed-size batches so
      // memory stays bounded — at the cost of reading every submission
      // twice. Acceptable at the scale this streaming approach already
      // targets (see this file's own top comment on what it isn't for).
      for (;;) {
        const batch = await SubmissionModel.find({
          formId: form._id,
          ...(lastId ? { _id: { $gt: lastId } } : {}),
        })
          .sort({ _id: 1 })
          .limit(BATCH_SIZE)
          .lean<{ _id: unknown; answers: Record<string, unknown> }[]>();
        if (batch.length === 0) break;
        for (const row of batch) {
          for (const key of Object.keys(row.answers ?? {})) {
            if (!fieldIds.has(key)) extraKeys.add(key);
          }
        }
        lastId = batch[batch.length - 1]._id;
        if (batch.length < BATCH_SIZE) break;
      }

      const columns = [
        ...fields.map((f) => f.label || f.id),
        ...[...extraKeys],
        "Submitted at",
        "Last edited at",
        "Revision",
        "Verified respondent",
      ];
      const columnKeys = [...fields.map((f) => f.id), ...extraKeys];
      controller.enqueue(encoder.encode(columns.map(csvCell).join(",") + "\r\n"));

      lastId = null;
      for (;;) {
        const batch = await SubmissionModel.find({
          formId: form._id,
          ...(lastId ? { _id: { $gt: lastId } } : {}),
        })
          .sort({ _id: 1 })
          .limit(BATCH_SIZE)
          .lean<
            {
              _id: unknown;
              answers: Record<string, unknown>;
              submittedAt: Date;
              updatedAt: Date;
              revisionNumber: number;
              respondentIdentityId: string | null;
            }[]
          >();
        if (batch.length === 0) break;
        for (const row of batch) {
          const cells = [
            ...columnKeys.map((key) => csvCell(row.answers?.[key])),
            csvCell(new Date(row.submittedAt).toISOString()),
            csvCell(new Date(row.updatedAt).toISOString()),
            csvCell(row.revisionNumber),
            csvCell(row.respondentIdentityId ? "yes" : "no"),
          ];
          controller.enqueue(encoder.encode(cells.join(",") + "\r\n"));
        }
        lastId = batch[batch.length - 1]._id;
        if (batch.length < BATCH_SIZE) break;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-responses.csv"`,
    },
  });
}
