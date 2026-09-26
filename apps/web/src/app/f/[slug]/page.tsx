import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedFormBySlug } from "@/lib/db/forms";
import { PublicForm } from "./public-form";

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{published.definition.name}</h1>
      <PublicForm slug={slug} definition={published.definition} />
    </div>
  );
}
