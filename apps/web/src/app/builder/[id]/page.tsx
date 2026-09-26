import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { FormDefinition } from "@hardikrastogi/core";
import { connectToDatabase } from "@/lib/db/connect";
import { DraftModel } from "@/lib/db/models/Draft";
import { FormModel } from "@/lib/db/models/Form";
import { getUserId } from "@/lib/auth/session";
import { isValidDraftId } from "@/lib/draft-id";
import { slugify } from "@/lib/slug";
import { BuilderPage } from "../builder-page";

export const metadata: Metadata = {
  title: "Builder",
  description: "Drag-and-drop authoring UI for building a Formora FormDefinition.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidDraftId(id)) notFound();

  const userId = await getUserId();
  if (!userId) redirect(`/signin?next=${encodeURIComponent(`/builder/${id}`)}`);

  await connectToDatabase();
  const draft = await DraftModel.findOne({ ownerAccountId: userId, definitionId: id }).lean<{ definition: unknown } | null>();
  const form = await FormModel.findOne({ slug: slugify(id), ownerAccountId: userId }).lean<{ slug: string; published: boolean } | null>();

  return (
    <BuilderPage
      formId={id}
      initialDefinition={(draft?.definition as FormDefinition | undefined) ?? null}
      initialPublished={form?.published ? { url: `/f/${form.slug}`, slug: form.slug } : null}
    />
  );
}
