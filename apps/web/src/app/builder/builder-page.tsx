"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Builder, createBlankDefinition, type PublishResult } from "@hardikrastogi/builder";
import "@hardikrastogi/builder/styles.css";
import type { FormDefinition } from "@hardikrastogi/core";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : fallback;
}

export function BuilderPage({
  formId,
  initialDefinition,
  initialPublished,
}: {
  formId: string;
  initialDefinition: FormDefinition | null;
  initialPublished: PublishResult | null;
}) {
  const definition = useMemo(
    () => initialDefinition ?? createBlankDefinition(formId, "My form"),
    [initialDefinition, formId],
  );

  async function saveDraft(next: FormDefinition): Promise<void> {
    const res = await fetch(`/api/drafts/${encodeURIComponent(formId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ definition: next }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not save."));
  }

  async function publishForm(next: FormDefinition): Promise<PublishResult> {
    const res = await fetch("/api/forms/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ definition: next }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not publish this form. Please try again."));
    const data = (await res.json()) as { url: string; slug: string };
    return { url: data.url, slug: data.slug };
  }

  async function unpublishForm(published: PublishResult): Promise<void> {
    if (!published.slug) throw new Error("Cannot unpublish: this form's link is missing its slug.");
    const res = await fetch(`/api/forms/${encodeURIComponent(published.slug)}/unpublish`, { method: "POST" });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not unpublish this form. Please try again."));
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl flex-col px-4 py-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Builder</h1>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          All my forms
        </Link>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Drag fields from the palette, or click one to add it. Select a field to edit it on the right. Changes save to
        your account automatically. Publish to get a shareable link anyone can fill out; Unpublish stops it
        accepting responses, and you can publish again any time.
      </p>
      <div className="min-h-0 flex-1">
        <Builder
          initialDefinition={definition}
          initialPublished={initialPublished}
          onSave={saveDraft}
          onPublish={publishForm}
          onUnpublish={unpublishForm}
        />
      </div>
    </div>
  );
}
