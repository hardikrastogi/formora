"use client";

import { useEffect, useState } from "react";
import { Builder, createBlankDefinition, loadFromStorage } from "@hardikrastogi/builder";
import "@hardikrastogi/builder/styles.css";
import type { FormDefinition } from "@hardikrastogi/core";

const DEMO_FORM_ID = "builder-demo";
const STORAGE_KEY = `formora-builder:${DEMO_FORM_ID}`;

export function BuilderPage() {
  const [initial, setInitial] = useState<FormDefinition | null>(null);

  useEffect(() => {
    // localStorage doesn't exist during server-side prerendering, so this must run
    // client-side only, after mount — that's why it's a real effect, not a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitial(loadFromStorage(STORAGE_KEY) ?? createBlankDefinition(DEMO_FORM_ID, "My form"));
  }, []);

  if (!initial) return null;

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl flex-col px-4 py-4">
      <h1 className="text-lg font-semibold">Builder</h1>
      <p className="mb-3 text-sm text-muted-foreground">
        Drag fields from the palette, or click one to add it. Select a field to edit it on the right. This demo
        autosaves to your browser only — hosted, shareable forms arrive in a later phase.
      </p>
      <div className="min-h-0 flex-1">
        <Builder initialDefinition={initial} />
      </div>
    </div>
  );
}
