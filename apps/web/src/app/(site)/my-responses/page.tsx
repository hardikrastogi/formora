import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/connect";
import { RespondentIdentityModel } from "@/lib/db/models/RespondentIdentity";
import { SubmissionModel } from "@/lib/db/models/Submission";
import { FormVersionModel } from "@/lib/db/models/FormVersion";
import { getUserId } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Your responses" };

export default async function MyResponsesPage() {
  const userId = await getUserId();
  if (!userId) redirect("/signin?next=/my-responses");

  await connectToDatabase();

  // A creator account only ever links to the one respondent identity that
  // matches their own account email — see lib/account-linking.ts.
  const identity = await RespondentIdentityModel.findOne({ linkedAccountId: userId }).lean<{ _id: unknown } | null>();

  const submissions = identity
    ? await SubmissionModel.find({ respondentIdentityId: String(identity._id) })
        .sort({ submittedAt: -1 })
        .lean<{ _id: unknown; formVersionId: unknown; submittedAt: Date }[]>()
    : [];

  const versionNames = new Map(
    (
      await FormVersionModel.find({ _id: { $in: submissions.map((s) => s.formVersionId) } })
        .select({ definition: 1 })
        .lean<{ _id: unknown; definition?: { name?: unknown } }[]>()
    ).map((v) => [String(v._id), typeof v.definition?.name === "string" ? v.definition.name : "Untitled form"]),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Your responses</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Forms you filled out and verified your email for, where the email matches this account. Only the form name
        and date are shown here — not your answers.
      </p>
      {submissions.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Nothing here yet. This fills in once you verify your email to fill out a form that uses email verification,
          using the same address as this account.
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded-md border">
          {submissions.map((s) => (
            <li key={String(s._id)} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm">{versionNames.get(String(s.formVersionId)) ?? "Untitled form"}</span>
              <span className="text-xs text-muted-foreground">
                {s.submittedAt.toLocaleString("en-GB", { timeZone: "UTC" })} UTC
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
