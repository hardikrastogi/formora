import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/auth/session";
import { getOwnedForm } from "@/lib/db/owned-form";
import { ResponsesList } from "./responses-list";

export const metadata: Metadata = { title: "Responses" };

export default async function ResponsesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/signin?next=${encodeURIComponent(`/forms/${slug}/responses`)}`);

  // A form that exists but belongs to someone else looks exactly like a
  // missing one — the same anti-enumeration rule as publish/unpublish.
  const form = await getOwnedForm(slug, userId);
  if (!form) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Responses</h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/builder/${slug}`} className="underline">
              Edit form
            </Link>{" "}
            ·{" "}
            <Link href="/dashboard" className="underline">
              All my forms
            </Link>
          </p>
        </div>
        <a href={`/api/forms/${slug}/responses/export`} className="text-sm underline">
          Export CSV
        </a>
      </div>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Loading…</p>}>
        <ResponsesList slug={slug} />
      </Suspense>
    </div>
  );
}
