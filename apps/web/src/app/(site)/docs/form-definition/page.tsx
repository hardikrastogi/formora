import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = { title: "FormDefinition" };

const FIELD = `{
  "id": "age",
  "type": "number",
  "label": "Age",
  "description": "Must be 18 or over.",
  "required": true,
  "defaultProps": { "placeholder": "18" },
  "validation": { "min": 18, "max": 120 },
  "style": { "borderColor": "#22c55e", "radius": "lg" }
}`;

const SUBMISSION = `{
  "formId": "contact",
  "schemaVersion": 1,
  "answers": { "name": "Ada Lovelace", "email": "ada@example.com" },
  "meta": { "submittedAt": "2026-09-21T10:30:00.000Z" }
}`;

export default function FormDefinitionPage() {
  return (
    <>
      <h1>FormDefinition</h1>
      <p className="lead">
        The single JSON document that describes a form. Everything in Formora reads it; nothing else is the source of
        truth.
      </p>

      <h2>Top level</h2>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>id</code>, <code>name</code>
            </td>
            <td>string</td>
            <td>Required, non-empty.</td>
          </tr>
          <tr>
            <td>
              <code>schemaVersion</code>
            </td>
            <td>integer &ge; 1</td>
            <td>Bump it when the form changes. Submissions record the version they answered.</td>
          </tr>
          <tr>
            <td>
              <code>createdAt</code>, <code>updatedAt</code>
            </td>
            <td>ISO 8601 string</td>
            <td>For example 2026-01-01T00:00:00.000Z.</td>
          </tr>
          <tr>
            <td>
              <code>fields</code>
            </td>
            <td>array</td>
            <td>What exists. Order here does not control layout.</td>
          </tr>
          <tr>
            <td>
              <code>layout</code>
            </td>
            <td>object</td>
            <td>Where each field sits on the grid.</td>
          </tr>
          <tr>
            <td>
              <code>theme</code>
            </td>
            <td>object</td>
            <td>Optional. Design tokens.</td>
          </tr>
          <tr>
            <td>
              <code>logic</code>
            </td>
            <td>object</td>
            <td>Optional. Visibility rules and calculated fields.</td>
          </tr>
        </tbody>
      </table>

      <h2>fields</h2>
      <p>A field with every option:</p>
      <CodeBlock title="field" code={FIELD} />
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>id</code>
            </td>
            <td>
              Unique. Must start with a letter and use only letters, digits, <code>_</code> or <code>-</code> (up to
              64 characters). This becomes the key in the answers.
            </td>
          </tr>
          <tr>
            <td>
              <code>type</code>
            </td>
            <td>
              Name of a registered field type, for example <code>text</code>. See{" "}
              <Link href="/docs/field-types">field types</Link>.
            </td>
          </tr>
          <tr>
            <td>
              <code>label</code>
            </td>
            <td>Required. Shown above the input.</td>
          </tr>
          <tr>
            <td>
              <code>description</code>
            </td>
            <td>Optional help text shown under the input.</td>
          </tr>
          <tr>
            <td>
              <code>required</code>
            </td>
            <td>
              Defaults to <code>false</code>. A value counts as missing if it is empty, an unticked checkbox, or an
              empty list.
            </td>
          </tr>
          <tr>
            <td>
              <code>defaultProps</code>
            </td>
            <td>
              Settings for the field type, such as <code>placeholder</code> or <code>options</code>. Set{" "}
              <code>defaultValue</code> to pre-fill the field.
            </td>
          </tr>
          <tr>
            <td>
              <code>validation</code>
            </td>
            <td>
              <code>minLength</code>, <code>maxLength</code>, <code>pattern</code> (a regular expression string) apply
              to text answers. <code>min</code>, <code>max</code> apply to numbers.
            </td>
          </tr>
          <tr>
            <td>
              <code>style</code>
            </td>
            <td>
              Per-field overrides: <code>textColor</code>, <code>backgroundColor</code>, <code>borderColor</code>,{" "}
              <code>radius</code>, <code>fontSize</code>. Use sparingly; prefer the form-wide theme.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>layout</h2>
      <p>
        A 12-column grid. Each row lists columns; each column has a <code>span</code> (1 to 12) and the{" "}
        <code>fieldId</code> it shows.
      </p>
      <ul>
        <li>A row&apos;s spans must not add up to more than 12.</li>
        <li>Every <code>fieldId</code> must exist in <code>fields</code>.</li>
        <li>A field missing from the layout is still rendered, full width, after the last row.</li>
        <li>On narrow screens (640px and below) columns stack.</li>
      </ul>

      <h2>theme</h2>
      <p>
        <code>colors</code> (<code>primary</code>, <code>background</code>, <code>text</code>), <code>radius</code>{" "}
        (<code>none</code>, <code>sm</code>, <code>md</code>, <code>lg</code>, <code>full</code>), <code>font</code>{" "}
        and <code>density</code> (<code>compact</code>, <code>comfortable</code>, <code>spacious</code>). Anything you
        leave out falls back to the stylesheet default. See <Link href="/docs/theming">theming</Link>.
      </p>

      <h2>logic</h2>
      <p className="callout">
        Logic is stored and validated (a rule pointing at a field that does not exist is rejected), but the renderer
        does not apply it yet. Treat it as reserved for now.
      </p>
      <p>
        <code>visibility</code> rules hide or show a <code>targetFieldId</code> based on <code>conditions</code>{" "}
        (<code>fieldId</code>, an <code>operator</code> such as <code>equals</code>, <code>notEquals</code>,{" "}
        <code>contains</code>, <code>greaterThan</code>, <code>lessThan</code>, <code>isEmpty</code>,{" "}
        <code>isNotEmpty</code>, and a <code>value</code>), combined with <code>match</code> of <code>all</code> or{" "}
        <code>any</code>. <code>calculated</code> entries derive a value from other fields via a <code>formula</code>.
      </p>

      <h2>Validation errors</h2>
      <p>
        A definition is checked before it is used. Duplicate field ids, over-wide rows, and layout or logic that
        points at a missing field are all rejected with a message naming the problem. The renderer shows that message
        instead of a broken form.
      </p>

      <h2>FormSubmission</h2>
      <p>The second document, created when someone submits:</p>
      <CodeBlock title="submission" code={SUBMISSION} />
      <p>
        <code>answers</code> is keyed by field id. <code>meta</code> is optional and can also carry <code>ip</code>{" "}
        and <code>userAgent</code>.
      </p>
    </>
  );
}
