import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormDefinitionSchema } from "@hardikrastogi/core";
import { getUserId } from "@/lib/auth/session";
import { getOwnedForm } from "@/lib/db/owned-form";
import { SubmissionModel } from "@/lib/db/models/Submission";
import { FormVersionModel } from "@/lib/db/models/FormVersion";

export const metadata: Metadata = { title: "Response" };

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ slug: string; submissionId: string }>;
}) {
  const { slug, submissionId } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/signin?next=${encodeURIComponent(`/forms/${slug}/responses/${submissionId}`)}`);

  const form = await getOwnedForm(slug, userId);
  if (!form) notFound();

  const submission = await SubmissionModel.findOne({ _id: submissionId, formId: form._id }).lean<{
    answers: Record<string, unknown>;
    formVersionId: unknown;
    submittedAt: Date;
    updatedAt: Date;
    revisionNumber: number;
    respondentIdentityId: string | null;
  } | null>();
  if (!submission) notFound();

  const version = await FormVersionModel.findById(submission.formVersionId).lean<{ definition?: unknown } | null>();
  const parsed = FormDefinitionSchema.safeParse(version?.definition);
  const fields = parsed.success ? parsed.data.fields : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-muted-foreground">
        <Link href={`/forms/${slug}/responses`} className="underline">
          ← All responses
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Response</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Submitted {submission.submittedAt.toLocaleString("en-GB", { timeZone: "UTC" })} UTC
        {submission.respondentIdentityId ? " · verified email" : ""}
        {submission.revisionNumber > 1
          ? ` · edited (revision ${submission.revisionNumber}, last changed ${submission.updatedAt.toLocaleString("en-GB", { timeZone: "UTC" })} UTC)`
          : ""}
      </p>

      <dl className="mt-6 divide-y rounded-md border">
        {fields.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            This response&apos;s original form version couldn&apos;t be read — showing raw answers instead.
          </p>
        ) : null}
        {fields.map((field) => {
          const value = submission.answers[field.id];
          const display =
            value === null || value === undefined || value === ""
              ? "(no answer)"
              : Array.isArray(value)
                ? value.join(", ")
                : String(value);
          return (
            <div key={field.id} className="px-4 py-3">
              <dt className="text-sm font-medium">{field.label}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{display}</dd>
            </div>
          );
        })}
        {fields.length === 0
          ? Object.entries(submission.answers).map(([key, value]) => (
              <div key={key} className="px-4 py-3">
                <dt className="text-sm font-medium">{key}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {value === null || value === undefined || value === "" ? "(no answer)" : String(value)}
                </dd>
              </div>
            ))
          : null}
      </dl>
    </div>
  );
}
