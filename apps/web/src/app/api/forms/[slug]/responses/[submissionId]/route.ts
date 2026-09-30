import { NextResponse } from "next/server";
import { FormDefinitionSchema } from "@hardikrastogi/core";
import { getUserId } from "@/lib/auth/session";
import { getOwnedForm } from "@/lib/db/owned-form";
import { SubmissionModel } from "@/lib/db/models/Submission";
import { FormVersionModel } from "@/lib/db/models/FormVersion";

export async function GET(_request: Request, context: { params: Promise<{ slug: string; submissionId: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { slug, submissionId } = await context.params;
  const form = await getOwnedForm(slug, userId);
  if (!form) return NextResponse.json({ error: "No form found for this slug." }, { status: 404 });

  // Matching on formId too means a response from a different form is
  // indistinguishable from a nonexistent id — never just "the id happens to
  // belong to someone else's form".
  const submission = await SubmissionModel.findOne({ _id: submissionId, formId: form._id }).lean<{
    _id: unknown;
    answers: Record<string, unknown>;
    formVersionId: unknown;
    submittedAt: Date;
    updatedAt: Date;
    revisionNumber: number;
    respondentIdentityId: string | null;
  } | null>();
  if (!submission) return NextResponse.json({ error: "Response not found." }, { status: 404 });

  // Resolved against the version this response actually answered, not
  // necessarily the form's current one — so labels stay correct even after
  // the creator has since changed the form.
  const version = await FormVersionModel.findById(submission.formVersionId).lean<{ definition?: unknown } | null>();
  const parsed = FormDefinitionSchema.safeParse(version?.definition);
  const fields = parsed.success ? parsed.data.fields.map((f) => ({ id: f.id, label: f.label, type: f.type })) : [];

  return NextResponse.json(
    {
      id: String(submission._id),
      fields,
      answers: submission.answers,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt,
      revisionNumber: submission.revisionNumber,
      verified: Boolean(submission.respondentIdentityId),
    },
    { status: 200 },
  );
}
