import { NextResponse } from "next/server";
import { FormDefinitionSchema } from "@hardikrastogi/core";
import { collectServerErrors } from "@hardikrastogi/react/server";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { FormVersionModel } from "@/lib/db/models/FormVersion";
import { SubmissionModel } from "@/lib/db/models/Submission";
import { hashToken } from "@/lib/respondent-verification";

/**
 * A respondent revising their own earlier answer, proven by the edit token
 * they were handed at submit time — not by re-verifying email or any other
 * credential, so this keeps working even after a verified-email respondent's
 * short-lived session cookie has long since expired.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { submissionId, editToken, answers } = (body ?? {}) as {
    submissionId?: unknown;
    editToken?: unknown;
    answers?: unknown;
  };
  if (typeof submissionId !== "string" || typeof editToken !== "string" || editToken.length < 20) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return NextResponse.json({ error: "answers must be an object." }, { status: 400 });
  }

  await connectToDatabase();
  const form = await FormModel.findOne({ slug });
  if (!form) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Same rule as a new submission: once the form is unpublished or past its
  // close date, it accepts no further respondent action, including edits.
  if (!form.published || !form.currentVersionId) {
    return NextResponse.json({ error: "This form is no longer accepting responses." }, { status: 410 });
  }
  if (form.closesAt && new Date() > form.closesAt) {
    return NextResponse.json({ error: "This form is closed." }, { status: 410 });
  }

  const submission = await SubmissionModel.findOne({
    _id: submissionId,
    formId: form._id,
    editTokenHash: hashToken(editToken),
  });
  if (!submission) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const version = await FormVersionModel.findById(form.currentVersionId);
  if (!version) return NextResponse.json({ error: "This form is no longer accepting responses." }, { status: 410 });
  const parsedDefinition = FormDefinitionSchema.safeParse(version.definition);
  if (!parsedDefinition.success) {
    return NextResponse.json({ error: "This form's definition is corrupted." }, { status: 500 });
  }

  const errors = collectServerErrors(parsedDefinition.data, answers as Record<string, unknown>);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  submission.answers = answers;
  submission.revisionNumber += 1;
  // The edit is now validated against, and counted as belonging to,
  // whichever version is live today — same as a fresh submission would be.
  submission.formVersionId = version._id;
  submission.schemaVersion = parsedDefinition.data.schemaVersion;
  await submission.save();

  return NextResponse.json(
    { submissionId: String(submission._id), revisionNumber: submission.revisionNumber },
    { status: 200 },
  );
}
