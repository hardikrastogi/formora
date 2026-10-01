"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Builder, createBlankDefinition, type PublishResult } from "@hardikrastogi/builder";
import "@hardikrastogi/builder/styles.css";
import type { FormDefinition } from "@hardikrastogi/core";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type AccessMode = "anyone" | "verified_email";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : fallback;
}

/** ISO string (or null) <-> the local "YYYY-MM-DDTHH:mm" value a datetime-local input needs. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BuilderPage({
  formId,
  initialDefinition,
  initialPublished,
  initialAccessMode,
  initialClosesAt,
  initialMaxResponses,
  initialLimitOneResponsePerRespondent,
  initialAllowResponseEditing,
}: {
  formId: string;
  initialAccessMode: AccessMode;
  initialClosesAt: string | null;
  initialMaxResponses: number | null;
  initialLimitOneResponsePerRespondent: boolean;
  initialAllowResponseEditing: boolean;
  initialDefinition: FormDefinition | null;
  initialPublished: PublishResult | null;
}) {
  // Who may respond. Sent with Publish, so it takes effect when you publish or republish.
  const [accessMode, setAccessMode] = useState<AccessMode>(initialAccessMode);
  // Empty string means "no close date". Kept as the datetime-local input's own
  // string format and converted to/from ISO only at the edges (load/publish).
  const [closesAtLocal, setClosesAtLocal] = useState(() => isoToLocalInput(initialClosesAt));
  // Empty string means "no cap". Kept as the number input's own string form.
  const [maxResponsesInput, setMaxResponsesInput] = useState(() =>
    initialMaxResponses !== null ? String(initialMaxResponses) : "",
  );
  const [limitOnePerRespondent, setLimitOnePerRespondent] = useState(initialLimitOneResponsePerRespondent);
  const [allowEditing, setAllowEditing] = useState(initialAllowResponseEditing);
  const definition = useMemo(
    () => initialDefinition ?? createBlankDefinition(formId, "My form"),
    [initialDefinition, formId],
  );

  const settingsSummary = [
    accessMode === "verified_email" ? "Verified email" : "Anyone with the link",
    closesAtLocal ? "closes" : null,
    maxResponsesInput ? `max ${maxResponsesInput}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
      // The datetime-local input has no timezone, so `new Date(...)` reads it in the
      // browser's own local time — exactly the time the creator saw and picked.
      body: JSON.stringify({
        definition: next,
        accessMode,
        closesAt: closesAtLocal ? new Date(closesAtLocal).toISOString() : null,
        maxResponses: maxResponsesInput ? Number(maxResponsesInput) : null,
        // Only meaningful (and only accepted by the server) in verified_email
        // mode — sending false otherwise keeps the checkbox's own state from
        // silently re-enabling something the server would reject anyway.
        limitOneResponsePerRespondent: accessMode === "verified_email" ? limitOnePerRespondent : false,
        allowResponseEditing: allowEditing,
      }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not publish this form. Please try again."));
    const data = (await res.json()) as { url: string; slug: string };
    toast.success("Form published");
    return { url: data.url, slug: data.slug };
  }

  async function unpublishForm(published: PublishResult): Promise<void> {
    if (!published.slug) throw new Error("Cannot unpublish: this form's link is missing its slug.");
    const res = await fetch(`/api/forms/${encodeURIComponent(published.slug)}/unpublish`, { method: "POST" });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not unpublish this form. Please try again."));
    toast.success("Form unpublished");
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl flex-col px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-lg font-semibold">Builder</h1>
          <p className="text-xs text-muted-foreground">Drag fields onto the canvas, or click one to add it.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
              Settings{settingsSummary ? <span className="text-muted-foreground"> · {settingsSummary}</span> : null}
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Form settings</DialogTitle>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <label htmlFor="access-mode" className="mb-1 block font-medium">
                    Who can respond
                  </label>
                  <select
                    id="access-mode"
                    value={accessMode}
                    onChange={(e) => setAccessMode(e.target.value as AccessMode)}
                    className="w-full rounded-md border bg-background px-2 py-1.5"
                  >
                    <option value="anyone">Anyone with the link</option>
                    <option value="verified_email">Only people who verify their email</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="closes-at" className="mb-1 block font-medium">
                    Closes
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="closes-at"
                      type="datetime-local"
                      value={closesAtLocal}
                      onChange={(e) => setClosesAtLocal(e.target.value)}
                      className="w-full rounded-md border bg-background px-2 py-1.5"
                    />
                    {closesAtLocal ? (
                      <button
                        type="button"
                        onClick={() => setClosesAtLocal("")}
                        className="shrink-0 text-muted-foreground underline hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Leave blank for no expiry.</p>
                </div>

                <div>
                  <label htmlFor="max-responses" className="mb-1 block font-medium">
                    Max responses
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="max-responses"
                      type="number"
                      min={1}
                      step={1}
                      value={maxResponsesInput}
                      onChange={(e) => setMaxResponsesInput(e.target.value)}
                      className="w-24 rounded-md border bg-background px-2 py-1.5"
                    />
                    {maxResponsesInput ? (
                      <button
                        type="button"
                        onClick={() => setMaxResponsesInput("")}
                        className="text-muted-foreground underline hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Leave blank for no limit.</span>
                    )}
                  </div>
                </div>

                <label
                  htmlFor="limit-one"
                  className={`flex items-start gap-2 ${accessMode !== "verified_email" ? "text-muted-foreground" : ""}`}
                >
                  <input
                    id="limit-one"
                    type="checkbox"
                    className="mt-0.5"
                    checked={accessMode === "verified_email" && limitOnePerRespondent}
                    disabled={accessMode !== "verified_email"}
                    onChange={(e) => setLimitOnePerRespondent(e.target.checked)}
                  />
                  <span>
                    Only one response per respondent
                    {accessMode !== "verified_email" ? (
                      <span className="block text-xs">Requires &quot;verify their email&quot; above.</span>
                    ) : null}
                  </span>
                </label>

                <label htmlFor="allow-editing" className="flex items-start gap-2">
                  <input
                    id="allow-editing"
                    type="checkbox"
                    className="mt-0.5"
                    checked={allowEditing}
                    onChange={(e) => setAllowEditing(e.target.checked)}
                  />
                  <span>Allow respondents to edit their response after submitting</span>
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <p className="text-xs text-muted-foreground">Applies when you Publish or Republish.</p>
                <DialogClose render={<Button size="sm">Done</Button>} />
              </div>
            </DialogContent>
          </Dialog>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            All my forms
          </Link>
        </div>
      </div>
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
