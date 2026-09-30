import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getPublishedFormBySlug } from "@/lib/db/forms";
import { currentTime } from "@/lib/now";
import { RespondentIdentityModel } from "@/lib/db/models/RespondentIdentity";
import { respondentCookieName, verifyRespondentToken } from "@/lib/respondent-session";
import { PublicForm } from "./public-form";
import { VerifyGate } from "./verify-gate";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const published = await getPublishedFormBySlug(slug);
  if (!published) return { title: "Form not found" };

  const title = published.definition.name;
  const description = `Fill out ${title} — built with Formora.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicFormPage({ params }: PageProps) {
  const { slug } = await params;
  const published = await getPublishedFormBySlug(slug);
  if (!published) notFound();

  if (published.closesAt && currentTime() > new Date(published.closesAt).getTime()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">{published.definition.name}</h1>
        <p role="status" className="text-muted-foreground">
          This form closed to new responses on{" "}
          {new Date(published.closesAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "long", timeStyle: "short" })}{" "}
          UTC.
        </p>
      </div>
    );
  }

  let verifiedEmail: string | null = null;
  if (published.accessMode === "verified_email") {
    const cookie = (await cookies()).get(respondentCookieName(published.formId))?.value;
    const identityId = verifyRespondentToken(cookie, published.formId);
    const identity = identityId
      ? await RespondentIdentityModel.findById(identityId).lean<{ normalizedValue: string } | null>()
      : null;

    // Not verified yet: show only the name and the email step. The fields are
    // never sent to the browser, so a sensitive form's questions stay private.
    if (!identity) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">{published.definition.name}</h1>
          <VerifyGate slug={slug} />
        </div>
      );
    }
    verifiedEmail = identity.normalizedValue;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{published.definition.name}</h1>
      {verifiedEmail ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Email verified as <strong>{verifiedEmail}</strong>.
        </p>
      ) : null}
      <PublicForm slug={slug} definition={published.definition} allowEditing={published.allowResponseEditing} />
    </div>
  );
}
