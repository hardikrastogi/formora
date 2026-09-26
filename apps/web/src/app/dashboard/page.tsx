import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/connect";
import { DraftModel } from "@/lib/db/models/Draft";
import { FormModel } from "@/lib/db/models/Form";
import { getUserId } from "@/lib/auth/session";
import { slugify } from "@/lib/slug";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "My forms" };

export default async function DashboardPage() {
  const userId = await getUserId();
  if (!userId) redirect("/signin?next=/dashboard");

  await connectToDatabase();
  const drafts = await DraftModel.find({ ownerAccountId: userId }).sort({ updatedAt: -1 }).lean();
  const forms = await FormModel.find({
    ownerAccountId: userId,
    slug: { $in: drafts.map((d) => slugify(d.definitionId)) },
  }).lean();
  const liveSlugs = new Set(forms.filter((f) => f.published).map((f) => f.slug));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My forms</h1>
        <Link href="/builder/new" className={buttonVariants()}>
          New form
        </Link>
      </div>
      {drafts.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          You have no forms yet. Choose New form to build your first one.
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded-md border">
          {drafts.map((d) => {
            const slug = slugify(d.definitionId);
            const live = liveSlugs.has(slug);
            return (
              <li key={d.definitionId} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/builder/${d.definitionId}`} className="font-medium hover:underline">
                    {d.name || "Untitled form"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Edited {new Date(d.updatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                  </p>
                </div>
                {live ? (
                  <a href={`/f/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">
                    Live: /f/{slug}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Not published</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
