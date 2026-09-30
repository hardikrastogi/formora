import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/connect";
import { DraftModel } from "@/lib/db/models/Draft";
import { FormModel } from "@/lib/db/models/Form";
import { FormVersionModel } from "@/lib/db/models/FormVersion";
import { getUserId } from "@/lib/auth/session";
import { slugify } from "@/lib/slug";
import { currentTime } from "@/lib/now";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "My forms" };

interface Entry {
  id: string; // what /builder/[id] expects — the draft's definitionId, or the form's own slug if there's no draft
  name: string;
  updatedAt: Date;
  slug: string | null;
  published: boolean;
  accessMode?: "anyone" | "verified_email";
  closesAt?: Date | null;
  maxResponses?: number | null;
}

export default async function DashboardPage() {
  const userId = await getUserId();
  if (!userId) redirect("/signin?next=/dashboard");

  await connectToDatabase();
  const drafts = await DraftModel.find({ ownerAccountId: userId }).lean();
  const forms = await FormModel.find({ ownerAccountId: userId }).lean();

  // Saving is now a deliberate click (see PHASE_5B_CREATOR_ACCOUNTS.md's
  // revision note), so a form can be published without ever having a saved
  // draft. Both are shown here, keyed by slug, so a published form never
  // silently disappears from this list just because its creator never
  // happened to click Save before Publish.
  const bySlug = new Map<string, Entry>();
  for (const d of drafts) {
    const slug = slugify(d.definitionId);
    bySlug.set(slug, {
      id: d.definitionId,
      name: d.name || "Untitled form",
      updatedAt: d.updatedAt,
      slug: null,
      published: false,
    });
  }

  const formsNeedingAName = forms.filter((f) => !bySlug.has(f.slug) && f.currentVersionId);
  const versionNames = new Map(
    (
      await FormVersionModel.find({ _id: { $in: formsNeedingAName.map((f) => f.currentVersionId) } })
        .select({ definition: 1 })
        .lean<{ _id: unknown; definition?: { name?: unknown } }[]>()
    ).map((v) => [String(v._id), typeof v.definition?.name === "string" ? v.definition.name : "Untitled form"]),
  );

  for (const f of forms) {
    const existing = bySlug.get(f.slug);
    if (existing) {
      existing.slug = f.slug;
      existing.published = f.published;
      existing.accessMode = f.accessMode;
      existing.closesAt = f.closesAt;
      existing.maxResponses = f.maxResponses;
    } else {
      bySlug.set(f.slug, {
        id: f.slug,
        name: versionNames.get(String(f.currentVersionId)) ?? "Untitled form",
        updatedAt: f.updatedAt,
        slug: f.slug,
        published: f.published,
        accessMode: f.accessMode,
        closesAt: f.closesAt,
        maxResponses: f.maxResponses,
      });
    }
  }

  const entries = [...bySlug.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const now = currentTime();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My forms</h1>
        <Link href="/builder/new" className={buttonVariants()}>
          New form
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          You have no forms yet. Choose New form to build your first one.
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded-md border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/builder/${entry.id}`} className="font-medium hover:underline">
                  {entry.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Edited {entry.updatedAt.toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                </p>
                {entry.slug ? (
                  <Link href={`/forms/${entry.slug}/responses`} className="text-xs underline">
                    Responses
                  </Link>
                ) : null}
              </div>
              {entry.published && entry.slug ? (
                <div className="text-right text-sm">
                  <a href={`/f/${entry.slug}`} className="text-muted-foreground hover:text-foreground">
                    Live{entry.accessMode === "verified_email" ? " (verified email)" : ""}: /f/{entry.slug}
                  </a>
                  {entry.closesAt ? (
                    <p className="text-xs text-muted-foreground">
                      {entry.closesAt.getTime() < now ? "Closed " : "Closes "}
                      {entry.closesAt.toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                    </p>
                  ) : null}
                  {entry.maxResponses ? (
                    <p className="text-xs text-muted-foreground">Max {entry.maxResponses} responses</p>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Not published</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
