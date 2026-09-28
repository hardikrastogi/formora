import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { SubmissionModel } from "@/lib/db/models/Submission";
import { hashToken } from "@/lib/respondent-verification";

/**
 * Lets a respondent's own browser recognise its own earlier submission —
 * after a refresh, or on a later visit — using the edit token it was handed
 * at submit time. Never lists or searches submissions; a token proves
 * exactly one specific submission and nothing else.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { submissionId, editToken } = (body ?? {}) as { submissionId?: unknown; editToken?: unknown };
  if (typeof submissionId !== "string" || typeof editToken !== "string" || editToken.length < 20) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await connectToDatabase();
  const form = await FormModel.findOne({ slug }).lean<{ _id: unknown } | null>();
  if (!form) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const submission = await SubmissionModel.findOne({
    _id: submissionId,
    formId: form._id,
    editTokenHash: hashToken(editToken),
  }).lean<{ answers: unknown; submittedAt: Date; updatedAt: Date; revisionNumber: number } | null>();
  // Wrong submissionId, wrong token, or a submission from before edit tokens
  // existed (editTokenHash: null never matches a real hash) — same 404 either way.
  if (!submission) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(
    {
      answers: submission.answers,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt,
      revisionNumber: submission.revisionNumber,
    },
    { status: 200 },
  );
}
