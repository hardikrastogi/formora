import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = { title: "Builder" };

const USAGE = `import { Builder, createBlankDefinition } from "@hardikrastogi/builder";
import "@hardikrastogi/builder/styles.css";

// Or pass an existing FormDefinition to edit one that already exists.
const initial = createBlankDefinition("form_1", "My form");

<Builder initialDefinition={initial} />`;

export default function BuilderDocsPage() {
  return (
    <>
      <h1>Builder</h1>
      <p className="lead">
        A drag-and-drop authoring UI for building a <code>FormDefinition</code> without writing JSON by hand. Try it
        live in the <Link href="/builder">builder demo</Link>.
      </p>

      <h2>Install and use</h2>
      <CodeBlock title="Builder.tsx" code={USAGE} />
      <p>
        <code>Builder</code> holds its own state internally — you don&apos;t manage the definition yourself. Read the
        current definition back out with <code>useBuilder((s) =&gt; s.definition)</code> from inside a{" "}
        <code>BuilderProvider</code>, or wrap your own save button around it.
      </p>

      <h2>Layout</h2>
      <p>Three panels, matching the classic form-builder shape:</p>
      <ul>
        <li>
          <strong>Palette (left)</strong> — field types grouped by category, with search. Click a field to add it, or
          drag it onto the canvas.
        </li>
        <li>
          <strong>Canvas (center)</strong> — the form as it&apos;s being built. Click a field to select it. Drag the{" "}
          <code>⠿</code> handle to reorder fields.
        </li>
        <li>
          <strong>Inspector (right)</strong> — settings for whatever is selected. With nothing selected, it shows the
          form-wide theme instead.
        </li>
      </ul>
      <p>
        A field&apos;s inspector has four tabs: <strong>Basic</strong> (label, description, required, placeholder or
        options), <strong>Validation</strong> (length or range rules, matching the field type), <strong>Logic</strong>{" "}
        (reserved — see below), and <strong>Style</strong> (width in grid columns, border colour, corner radius).
      </p>

      <h2>Undo, redo, and the Theme button</h2>
      <p>
        Every edit is undoable. The <strong>Theme</strong> button next to Undo/Redo clears the current selection and
        returns the inspector to the form-wide theme — the same as clicking empty space on the canvas.
      </p>

      <h2>Accessibility contrast check</h2>
      <p>
        Changing the theme&apos;s primary colour checks its contrast against white button text. Below the WCAG AA
        minimum of 4.5:1, an inline warning explains the actual ratio and suggests a darker colour.
      </p>

      <h2>Preview</h2>
      <p>
        The Preview button swaps the three-panel editor for the real, working form — the same{" "}
        <Link href="/docs/quickstart">FormRenderer</Link> your visitors would see, with live validation.
      </p>

      <h2>Autosave</h2>
      <p className="callout">
        The hosted <Link href="/builder">builder demo</Link> autosaves to your browser&apos;s local storage only, as a
        stand-in for the real backend autosave arriving with hosted forms. It is not shared between devices or
        browsers, and clearing site data will lose it.
      </p>
      <p>
        In your own app, pass a <code>storageKey</code> to scope this per form, or swap it out entirely for a real
        save request — <code>Builder</code> doesn&apos;t require the built-in autosave at all.
      </p>

      <h2>What&apos;s not built yet</h2>
      <ul>
        <li>The Logic tab is a placeholder — conditional visibility and calculated fields are a later phase.</li>
        <li>
          Fields are one per row for now; multi-column layouts are set through a field&apos;s Style tab (a numeric
          width from 1 to 12), not by dragging fields side by side.
        </li>
        <li>Sharing, publishing, and multi-device sync arrive with hosted forms.</li>
      </ul>
    </>
  );
}
