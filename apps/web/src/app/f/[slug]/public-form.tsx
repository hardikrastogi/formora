"use client";

import { useEffect, useRef, useState } from "react";
import { FormRenderer, type Answers } from "@hardikrastogi/react";
import type { FormDefinition } from "@hardikrastogi/core";

function storageKey(slug: string): string {
  return `formora-submission:${slug}`;
}

interface StoredSubmission {
  submissionId: string;
  editToken: string;
}

function readStored(slug: string): StoredSubmission | null {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSubmission>;
    if (typeof parsed.submissionId === "string" && typeof parsed.editToken === "string") {
      return { submissionId: parsed.submissionId, editToken: parsed.editToken };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStored(slug: string, value: StoredSubmission | null) {
  try {
    if (value) window.localStorage.setItem(storageKey(slug), JSON.stringify(value));
    else window.localStorage.removeItem(storageKey(slug));
  } catch {
    // Storage full/disabled: the confirmation still shows for this page view,
    // it just won't be recognised again after a refresh. Not fatal.
  }
}

type Status =
  | { kind: "checking" }
  | { kind: "form"; defaultValues?: Answers }
  | { kind: "submitted"; answers: Answers }
  | { kind: "editing"; answers: Answers };

export function PublicForm({
  slug,
  definition,
  allowEditing,
}: {
  slug: string;
  definition: FormDefinition;
  allowEditing: boolean;
}) {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const stored = useRef<StoredSubmission | null>(null);
  // One id per page load; reused on every retry so a double-click or a
  // network retry can never create two submissions server-side.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = readStored(slug);
      if (!existing) {
        setStatus({ kind: "form" });
        return;
      }
      try {
        const res = await fetch(`/api/forms/${slug}/submission/lookup`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(existing),
        });
        const data = res.ok ? ((await res.json()) as { answers: Answers }) : null;
        if (cancelled) return;
        if (data) {
          stored.current = existing;
          setStatus({ kind: "submitted", answers: data.answers });
        } else {
          // The token no longer matches anything real (form deleted, or a
          // stale entry from before edit tokens existed) — forget it and let
          // the respondent fill the form again.
          writeStored(slug, null);
          setStatus({ kind: "form" });
        }
      } catch {
        if (!cancelled) setStatus({ kind: "form" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status.kind === "checking") return null;

  if (status.kind === "submitted") {
    return (
      <div className="df-form" role="status">
        <p>Your submission has been recorded.</p>
        {allowEditing ? (
          <button
            type="button"
            className="mt-3 text-sm underline"
            onClick={() => setStatus({ kind: "editing", answers: status.answers })}
          >
            Edit your response
          </button>
        ) : null}
      </div>
    );
  }

  const editing = status.kind === "editing";

  return (
    <FormRenderer
      definition={definition}
      defaultValues={editing ? status.answers : undefined}
      submitLabel={editing ? "Save changes" : "Submit"}
      onSubmit={async (answers: Answers) => {
        if (editing && stored.current) {
          const res = await fetch(`/api/forms/${slug}/submission/update`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...stored.current, answers }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Could not save your changes. Please try again.");
          }
          setStatus({ kind: "submitted", answers });
          return;
        }

        const res = await fetch(`/api/forms/${slug}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers, idempotencyKey: idempotencyKeyRef.current }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not submit this form. Please try again.");
        }
        const data = (await res.json()) as { submissionId: string; editToken: string | null };
        if (data.editToken) {
          const next = { submissionId: data.submissionId, editToken: data.editToken };
          stored.current = next;
          writeStored(slug, next);
        }
        setStatus({ kind: "submitted", answers });
      }}
    />
  );
}
