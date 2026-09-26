import { NextResponse } from "next/server";
import { FormDefinitionSchema } from "@hardikrastogi/core";
import { collectServerErrors } from "@hardikrastogi/react/server";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { FormVersionModel } from "@/lib/db/models/FormVersion";
import { SubmissionModel } from "@/lib/db/models/Submission";

const DUPLICATE_KEY_ERROR_CODE = 11000;

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { answers, idempotencyKey } = (body ?? {}) as { answers?: unknown; idempotencyKey?: unknown };
  if (typeof idempotencyKey !== "string" || !idempotencyKey) {
    return NextResponse.json({ error: "idempotencyKey is required." }, { status: 400 });
  }
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return NextResponse.json({ error: "answers must be an object." }, { status: 400 });
  }

  await connectToDatabase();

  const form = await FormModel.findOne({ slug });
  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }
  if (!form.published || !form.currentVersionId) {
    return NextResponse.json({ error: "This form is no longer accepting responses." }, { status: 410 });
  }
  if (form.closesAt && new Date() > form.closesAt) {
    return NextResponse.json({ error: "This form is closed." }, { status: 410 });
  }

  const version = await FormVersionModel.findById(form.currentVersionId);
  if (!version) {
    return NextResponse.json({ error: "This form is no longer accepting responses." }, { status: 410 });
  }

  const parsedDefinition = FormDefinitionSchema.safeParse(version.definition);
  if (!parsedDefinition.success) {
    return NextResponse.json({ error: "This form's definition is corrupted." }, { status: 500 });
  }

  if (form.maxResponses !== null && form.maxResponses !== undefined) {
    const count = await SubmissionModel.countDocuments({ formId: form._id });
    if (count >= form.maxResponses) {
      return NextResponse.json({ error: "This form has reached its response limit." }, { status: 410 });
    }
  }

  // Never trust the browser: re-run the exact same checks it already ran —
  // core's required/min/max/pattern rules AND the built-in email/url format
  // checks, the same combination FormRenderer uses client-side. A form using
  // a custom field type registered only in the browser can't be re-checked here.
  const errors = collectServerErrors(parsedDefinition.data, answers as Record<string, unknown>);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  try {
    const submission = await SubmissionModel.create({
      formId: form._id,
      formVersionId: version._id,
      schemaVersion: parsedDefinition.data.schemaVersion,
      answers,
      idempotencyKey,
    });
    return NextResponse.json({ submissionId: String(submission._id) }, { status: 201 });
  } catch (error) {
    // A retried click/network retry with the same key lands here — the
    // original submission already succeeded, so this is success too.
    if (isDuplicateKeyError(error)) {
      const existing = await SubmissionModel.findOne({ formId: form._id, idempotencyKey });
      return NextResponse.json({ submissionId: existing ? String(existing._id) : null }, { status: 201 });
    }
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === DUPLICATE_KEY_ERROR_CODE;
}
