import type { Metadata } from "next";

export const metadata: Metadata = { title: "Field types" };

const ROWS = [
  ["text", "string", "placeholder, autoComplete"],
  ["email", "string", "placeholder, autoComplete. Also checks the email format."],
  ["number", "number", "placeholder"],
  ["select", "string", "placeholder, options"],
  ["date", "string (YYYY-MM-DD)", "none"],
  ["time", "string (HH:MM)", "none"],
  ["checkbox", "boolean", "none. When required, it must be ticked."],
  ["radio", "string", "options"],
  ["textarea", "string", "placeholder, rows (default 4)"],
  ["url", "string", "placeholder. Also checks it is a valid http(s) URL."],
  ["rating", "number", "max (default 5) — the number of stars"],
  ["country", "string (ISO 3166-1 alpha-2)", "placeholder, options (a real country list ships by default)"],
  ["currency", "string (ISO 4217 code)", "placeholder, options (a curated currency list ships by default)"],
] as const;

export default function FieldTypesPage() {
  return (
    <>
      <h1>Field types</h1>
      <p className="lead">13 built in. Anything else is a plugin you register yourself.</p>

      <table>
        <thead>
          <tr>
            <th>type</th>
            <th>Answer value</th>
            <th>defaultProps</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([type, value, props]) => (
            <tr key={type}>
              <td>
                <code>{type}</code>
              </td>
              <td>{value}</td>
              <td>{props}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Options</h2>
      <p>
        <code>select</code>, <code>radio</code>, <code>country</code> and <code>currency</code> all read{" "}
        <code>defaultProps.options</code>. <code>country</code> and <code>currency</code> ship with a sensible default
        list already, but setting your own <code>options</code> on the field replaces it entirely. Use plain strings,
        or objects when the stored value should differ from the label:
      </p>
      <p>
        <code>{'["Free", "Pro"]'}</code>
      </p>
      <p>
        <code>{'[{ "label": "United States", "value": "us" }]'}</code>
      </p>

      <h2>Pre-filling</h2>
      <p>
        Set <code>defaultProps.defaultValue</code> on a field to give it an initial answer, or pass{" "}
        <code>defaultValues</code> to <code>FormRenderer</code> (for example to show a saved response).
      </p>

      <h2>Unknown types</h2>
      <p>
        If a definition uses a type nobody registered, that field renders a clear &quot;Unsupported field type&quot;
        message and the rest of the form keeps working.
      </p>

      <h2>Why select is a native element</h2>
      <p>
        The <code>select</code> field uses the browser&apos;s own dropdown. It is fully accessible, works well on
        phones and needs no extra code. Checkbox and radio use Radix primitives.
      </p>
    </>
  );
}
