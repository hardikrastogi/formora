import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Introduction" };

export default function IntroductionPage() {
  return (
    <>
      <h1>Introduction</h1>
      <p className="lead">
        Formora turns one JSON document into a working, validated, themeable form. You describe the form as data, and
        the packages do the rest.
      </p>

      <h2>The idea</h2>
      <p>
        A form is a plain object called a <code>FormDefinition</code>: its fields, how they are laid out on a
        12-column grid, its theme, and its rules. Everything else consumes that one object. The renderer draws it,
        the validator checks answers against it, and storage just persists it.
      </p>
      <p>
        When someone fills the form in, you get a second document, a <code>FormSubmission</code>, holding their
        answers and the <code>schemaVersion</code> of the form they answered. Storing the version means an old
        response still makes sense after the form has changed.
      </p>

      <h2>Two packages</h2>
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>What it does</th>
            <th>Needs React</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>@hardikrastogi/core</code>
            </td>
            <td>Zod schemas for definitions and submissions, the validation engine, versioning helpers, the field-type registry.</td>
            <td>No</td>
          </tr>
          <tr>
            <td>
              <code>@hardikrastogi/react</code>
            </td>
            <td>
              The <code>FormRenderer</code> component and <code>useFormRenderer</code> hook, 8 built-in field types, a
              small stylesheet.
            </td>
            <td>Yes (18 or newer)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Because <code>core</code> has no UI, you can run the same validation on your server that the browser runs.
      </p>

      <h2>Status</h2>
      <p className="callout">
        Formora is early. The packages are versioned <code>0.x</code>, so the API can still change between minor
        versions. Conditional logic and calculated fields are part of the schema but are not applied by the renderer
        yet.
      </p>

      <h2>Where to go next</h2>
      <ul>
        <li>
          <Link href="/docs/installation">Install</Link> the packages.
        </li>
        <li>
          Follow the <Link href="/docs/quickstart">quickstart</Link> to render your first form.
        </li>
        <li>
          Try things live in the <Link href="/playground">playground</Link>.
        </li>
      </ul>
    </>
  );
}
