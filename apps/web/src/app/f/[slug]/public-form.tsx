"use client";

import { useRef, useState } from "react";
import { FormRenderer, type Answers } from "@hardikrastogi/react";
import type { FormDefinition } from "@hardikrastogi/core";

export function PublicForm({ slug, definition }: { slug: string; definition: FormDefinition }) {
  const [submitted, setSubmitted] = useState(false);
  // One id per page load; reused on every retry so a double-click or a
  // network retry can never create two submissions server-side.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  if (submitted) {
    return (
      <div className="df-form" role="status">
        <p>Your submission has been recorded.</p>
      </div>
    );
  }

  return (
    <FormRenderer
      definition={definition}
      onSubmit={async (answers: Answers) => {
        const res = await fetch(`/api/forms/${slug}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers, idempotencyKey: idempotencyKeyRef.current }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not submit this form. Please try again.");
        }
        setSubmitted(true);
      }}
    />
  );
}
