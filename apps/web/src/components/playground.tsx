"use client";

import { useMemo, useState } from "react";
import type { FormDefinitionInput } from "@hardikrastogi/core";
import { FormRenderer, createDefaultRegistry, type Answers } from "@hardikrastogi/react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXAMPLES } from "@/lib/examples";
import { ratingPlugin } from "@/lib/rating-field";
import { cn } from "@/lib/utils";

const registry = createDefaultRegistry();
registry.register(ratingPlugin);

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

type Parsed = { ok: true; value: unknown } | { ok: false; message: string };

function parseJson(text: string): Parsed {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

// Remount the form only when fields are added, removed or retyped, not on every label edit,
// so typing in the editor does not wipe answers already entered in the preview.
function structureKey(definition: unknown): string {
  const fields = (definition as { fields?: unknown } | null)?.fields;
  if (!Array.isArray(fields)) return "invalid";
  return fields
    .map((f) => {
      const field = (f ?? {}) as { id?: unknown; type?: unknown };
      return `${String(field.id)}:${String(field.type)}`;
    })
    .join("|");
}

function buildSubmission(definition: unknown, answers: Answers) {
  const def = (definition ?? {}) as { id?: unknown; schemaVersion?: unknown };
  return {
    formId: def.id,
    schemaVersion: def.schemaVersion,
    answers,
    meta: { submittedAt: new Date().toISOString() },
  };
}

export function Playground() {
  const [exampleId, setExampleId] = useState(EXAMPLES[0].id);
  const [text, setText] = useState(() => pretty(EXAMPLES[0].definition));
  const [resetCount, setResetCount] = useState(0);
  const [submission, setSubmission] = useState<unknown>(null);
  const [panel, setPanel] = useState<"editor" | "preview">("editor");

  const parsed = useMemo(() => parseJson(text), [text]);
  const [lastGood, setLastGood] = useState<unknown>(EXAMPLES[0].definition);
  if (parsed.ok && parsed.value !== lastGood) setLastGood(parsed.value);


  function selectExample(id: string) {
    const example = EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    setExampleId(id);
    setText(pretty(example.definition));
    setLastGood(example.definition);
    setSubmission(null);
    setResetCount((c) => c + 1);
  }

  function format() {
    if (parsed.ok) setText(pretty(parsed.value));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Playground</h1>
      <p className="mb-4 mt-1 text-muted-foreground">
        Edit the JSON and the form updates as you type. Fill it in and submit to see exactly what your backend would
        receive.
      </p>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Examples">
        {EXAMPLES.map((example) => (
          <Button
            key={example.id}
            size="sm"
            variant={example.id === exampleId ? "default" : "outline"}
            aria-pressed={example.id === exampleId}
            onClick={() => selectExample(example.id)}
          >
            {example.name}
          </Button>
        ))}
      </div>

      <Tabs
        value={panel}
        onValueChange={(value) => setPanel(value === "preview" ? "preview" : "editor")}
        className="mb-3 lg:hidden"
      >
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Definition editor" className={cn(panel === "editor" ? "block" : "hidden", "lg:block")}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">FormDefinition (JSON)</h2>
            <div className="flex gap-2">
              <Button size="xs" variant="outline" onClick={format} disabled={!parsed.ok}>
                Format
              </Button>
              <CopyButton text={text} />
              <Button size="xs" variant="outline" onClick={() => selectExample(exampleId)}>
                Reset
              </Button>
            </div>
          </div>
          <textarea
            aria-label="FormDefinition JSON"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            className="h-[65vh] min-h-64 w-full resize-y rounded-lg border bg-muted/30 p-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {!parsed.ok && (
            <p role="alert" data-testid="json-error" className="mt-2 text-sm text-destructive">
              Invalid JSON ({parsed.message}). Showing the last valid version.
            </p>
          )}
        </section>

        <section aria-label="Live preview" className={cn(panel === "preview" ? "block" : "hidden", "lg:block")}>
          <h2 className="mb-2 text-sm font-semibold">Live preview</h2>
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <FormRenderer
              key={`${exampleId}-${resetCount}-${structureKey(lastGood)}`}
              definition={lastGood as FormDefinitionInput}
              registry={registry}
              onSubmit={(answers) => setSubmission(buildSubmission(lastGood, answers))}
            />
          </div>

          {submission !== null && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Submission (what your backend receives)</h2>
                <CopyButton text={pretty(submission)} />
              </div>
              <pre
                data-testid="submission-output"
                tabIndex={0}
                role="region"
                aria-label="Submission JSON"
                className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-sm"
              >
                {pretty(submission)}
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
