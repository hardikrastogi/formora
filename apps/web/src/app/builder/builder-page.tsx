"use client";

import { useEffect, useState } from "react";
import { Builder, createBlankDefinition, loadFromStorage, type PublishResult } from "@hardikrastogi/builder";
import "@hardikrastogi/builder/styles.css";
import type { FormDefinition } from "@hardikrastogi/core";

const DEMO_FORM_ID = "builder-demo";
const STORAGE_KEY = `formora-builder:${DEMO_FORM_ID}`;
// Stand-in until creator accounts (Phase 5b) can answer "which of my forms are live?" from the server.
const PUBLISHED_KEY = `formora-builder-published:${DEMO_FORM_ID}`;

function loadPublished(): PublishResult | null {
  try {
    const raw = window.localStorage.getItem(PUBLISHED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublishResult>;
    return typeof parsed.url === "string" ? { url: parsed.url, slug: parsed.slug } : null;
  } catch {
    return null;
  }
}

function savePublished(result: PublishResult | null) {
  try {
    if (result) window.localStorage.setItem(PUBLISHED_KEY, JSON.stringify(result));
    else window.localStorage.removeItem(PUBLISHED_KEY);
  } catch {
    // Storage can be unavailable (private mode); losing this only means the
    // Unpublish button isn't offered after a reload, never a broken publish.
  }
}

async function publishForm(definition: FormDefinition): Promise<PublishResult> {
  const res = await fetch("/api/forms/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ definition }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not publish this form. Please try again.");
  }
  const data = (await res.json()) as { url: string; slug: string };
  const result = { url: data.url, slug: data.slug };
  savePublished(result);
  return result;
}

async function unpublishForm(published: PublishResult): Promise<void> {
  if (!published.slug) throw new Error("Cannot unpublish: this form's link is missing its slug.");
  const res = await fetch(`/api/forms/${encodeURIComponent(published.slug)}/unpublish`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not unpublish this form. Please try again.");
  }
  savePublished(null);
}

export function BuilderPage() {
  const [initial, setInitial] = useState<{ definition: FormDefinition; published: PublishResult | null } | null>(null);

  useEffect(() => {
    // localStorage doesn't exist during server-side prerendering, so this must run
    // client-side only, after mount — that's why it's a real effect, not a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitial({
      definition: loadFromStorage(STORAGE_KEY) ?? createBlankDefinition(DEMO_FORM_ID, "My form"),
      published: loadPublished(),
    });
  }, []);

  if (!initial) return null;

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl flex-col px-4 py-4">
      <h1 className="text-lg font-semibold">Builder</h1>
      <p className="mb-3 text-sm text-muted-foreground">
        Drag fields from the palette, or click one to add it. Select a field to edit it on the right, then Publish to
        get a shareable link anyone can fill out. Unpublish stops the link from accepting responses; publish again
        any time to bring it back.
      </p>
      <div className="min-h-0 flex-1">
        <Builder
          initialDefinition={initial.definition}
          initialPublished={initial.published}
          onPublish={publishForm}
          onUnpublish={unpublishForm}
        />
      </div>
    </div>
  );
}
