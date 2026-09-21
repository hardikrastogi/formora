import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = { title: "Custom field types" };

const PLUGIN = `import { z } from "zod";
import type { FieldRendererProps, ReactFieldPlugin } from "@hardikrastogi/react";

function RatingInput({ props, value, onChange, onBlur, inputId, labelId, invalid, disabled }: FieldRendererProps) {
  const max = typeof props.max === "number" ? props.max : 5;
  const current = typeof value === "number" ? value : 0;

  return (
    <div id={inputId} role="radiogroup" aria-labelledby={labelId} aria-invalid={invalid || undefined} tabIndex={-1}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={current === n}
          aria-label={"Rate " + n}
          disabled={disabled}
          onClick={() => onChange(n)}
          onBlur={onBlur}
        >
          {n <= current ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

export const ratingPlugin: ReactFieldPlugin = {
  type: "rating",
  schema: z.number().int().min(1),
  defaultProps: { max: 5 },
  labelKind: "group",
  Renderer: RatingInput,
};`;

const REGISTER = `import { FormRenderer, createDefaultRegistry } from "@hardikrastogi/react";

// Create once, outside your component
const registry = createDefaultRegistry();
registry.register(ratingPlugin);

<FormRenderer definition={definition} registry={registry} />`;

const USE = `{ "id": "rating", "type": "rating", "label": "How was it?", "required": true, "defaultProps": { "max": 5 } }`;

export default function CustomFieldsPage() {
  return (
    <>
      <h1>Custom field types</h1>
      <p className="lead">
        Field types are plugins, not a fixed list. Register your own and use its name as <code>type</code> in any
        definition.
      </p>

      <h2>1. Write the plugin</h2>
      <CodeBlock title="rating.tsx" code={PLUGIN} />

      <h2>2. Register it</h2>
      <CodeBlock title="register" code={REGISTER} />

      <h2>3. Use it in JSON</h2>
      <CodeBlock title="field" code={USE} />
      <p>
        The <Link href="/playground">playground</Link> registers exactly this rating field. Pick the &quot;Custom
        field&quot; example to see it.
      </p>

      <h2>The plugin object</h2>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>type</code>
            </td>
            <td>The name used in definitions.</td>
          </tr>
          <tr>
            <td>
              <code>schema</code>
            </td>
            <td>A Zod schema describing a valid answer.</td>
          </tr>
          <tr>
            <td>
              <code>defaultProps</code>
            </td>
            <td>Defaults for the field&apos;s own <code>defaultProps</code>; the field&apos;s values win.</td>
          </tr>
          <tr>
            <td>
              <code>Renderer</code>
            </td>
            <td>The React component that draws the input.</td>
          </tr>
          <tr>
            <td>
              <code>labelKind</code>
            </td>
            <td>
              <code>control</code> (label tied to one input, the default), <code>group</code> (label names a group of
              controls) or <code>inline</code> (your component draws its own label).
            </td>
          </tr>
          <tr>
            <td>
              <code>emptyValue</code>
            </td>
            <td>Initial answer when nothing else is set.</td>
          </tr>
          <tr>
            <td>
              <code>validate</code>
            </td>
            <td>
              Optional. Receives the value and merged props, returns an object with a boolean <code>valid</code> and
              an <code>errors</code> array. Runs after the built-in rules, only for non-empty answers.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>What Renderer receives</h2>
      <table>
        <thead>
          <tr>
            <th>Prop</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>value</code>, <code>onChange</code>, <code>onBlur</code>
            </td>
            <td>The current answer and how to change it.</td>
          </tr>
          <tr>
            <td>
              <code>field</code>
            </td>
            <td>The field&apos;s config (id, label, required, and so on).</td>
          </tr>
          <tr>
            <td>
              <code>props</code>
            </td>
            <td>Plugin defaults merged with the field&apos;s <code>defaultProps</code>.</td>
          </tr>
          <tr>
            <td>
              <code>inputId</code>, <code>labelId</code>, <code>describedBy</code>
            </td>
            <td>Ids to wire up the label, description and error for accessibility.</td>
          </tr>
          <tr>
            <td>
              <code>invalid</code>, <code>disabled</code>
            </td>
            <td>Current state.</td>
          </tr>
          <tr>
            <td>
              <code>classNames</code>
            </td>
            <td>The consumer&apos;s class name overrides.</td>
          </tr>
        </tbody>
      </table>
      <p className="callout">
        Give the element that owns the invalid state <code>aria-invalid</code>. The form uses it to focus the first
        problem after a failed submit.
      </p>
    </>
  );
}
