import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = { title: "Quickstart" };

const RENDER = `import { FormRenderer } from "@hardikrastogi/react";
import type { FormDefinitionInput } from "@hardikrastogi/core";
import "@hardikrastogi/react/styles.css";

const definition: FormDefinitionInput = {
  id: "contact",
  name: "Contact",
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  fields: [
    { id: "name", type: "text", label: "Name", required: true },
    { id: "email", type: "email", label: "Email", required: true },
    { id: "message", type: "textarea", label: "Message", validation: { minLength: 10 } },
  ],
  layout: {
    rows: [
      {
        id: "r1",
        columns: [
          { span: 6, fieldId: "name" },
          { span: 6, fieldId: "email" },
        ],
      },
      { id: "r2", columns: [{ span: 12, fieldId: "message" }] },
    ],
  },
};

export function ContactForm() {
  return (
    <FormRenderer
      definition={definition}
      onSubmit={async (answers) => {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            formId: definition.id,
            schemaVersion: definition.schemaVersion,
            answers,
          }),
        });
        if (!res.ok) throw new Error("Could not send your response. Please try again.");
      }}
    />
  );
}`;

const SERVER = `import { FormDefinitionSchema, validateSubmission } from "@hardikrastogi/core";

// Load the definition you stored for this form, then check the answers again on the server.
const definition = FormDefinitionSchema.parse(storedDefinition);
const result = validateSubmission(definition, body.answers);

if (!result.success) {
  // result.errors is { [fieldId]: string[] }
  return Response.json({ errors: result.errors }, { status: 422 });
}`;

const ANSWERS = `{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "message": "Hello, this is a test message."
}`;

export default function QuickstartPage() {
  return (
    <>
      <h1>Quickstart</h1>
      <p className="lead">Render a form from JSON and receive validated answers in about thirty lines.</p>

      <h2>1. Describe the form and render it</h2>
      <CodeBlock title="ContactForm.tsx" code={RENDER} />
      <p>
        That is the whole client side. <code>FormRenderer</code> parses the definition, draws the fields on the grid,
        validates on submit (focusing the first invalid field), and calls <code>onSubmit</code> only when everything
        is valid. If <code>onSubmit</code> throws, the error message is shown under the form and the form stays
        usable.
      </p>

      <h2>2. What onSubmit receives</h2>
      <p>
        A plain object keyed by field id. Empty fields are left out, numbers are real numbers and checkboxes are
        booleans.
      </p>
      <CodeBlock title="answers" code={ANSWERS} />

      <h2>3. Validate again on your server</h2>
      <p>
        Never trust the browser. The same rules run anywhere JavaScript runs, because they live in{" "}
        <code>@hardikrastogi/core</code>, not in the UI.
      </p>
      <CodeBlock title="server" code={SERVER} />

      <h2>Next</h2>
      <ul>
        <li>
          See every option in the <Link href="/docs/form-definition">FormDefinition reference</Link>.
        </li>
        <li>
          Change the look with <Link href="/docs/theming">theming</Link>.
        </li>
        <li>
          Experiment in the <Link href="/playground">playground</Link> without writing any code.
        </li>
      </ul>
    </>
  );
}
