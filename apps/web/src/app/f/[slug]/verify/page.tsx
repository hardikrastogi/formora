import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedFormBySlug } from "@/lib/db/forms";
import { ContinueButton } from "./continue-button";

export const metadata: Metadata = {
  title: "Continue to form",
  // Links carry a secret; keep the page out of search results and never send it as a referrer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The link in the email opens this page. Loading it must NOT use up the token
// (mail scanners open links automatically), so nothing happens until the
// person presses the button, which POSTs the token.
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;
  const published = await getPublishedFormBySlug(slug);
  if (!published || published.accessMode !== "verified_email") notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">{published.definition.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your email link is ready. Continue to open the form.
      </p>
      <ContinueButton slug={slug} token={typeof token === "string" ? token : ""} />
    </div>
  );
}
