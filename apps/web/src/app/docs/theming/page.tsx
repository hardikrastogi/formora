import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = { title: "Theming" };

const THEME = `{
  "theme": {
    "colors": { "primary": "#16a34a", "background": "#ffffff", "text": "#111827" },
    "radius": "lg",
    "font": "Georgia",
    "density": "spacious"
  }
}`;

const CSS = `/* Override any token yourself, for one form or for all of them */
.df-form {
  --df-primary: #7c3aed;
  --df-border: #cbd5e1;
  --df-danger: #be123c;
}`;

const CLASSNAMES = `<FormRenderer
  definition={definition}
  classNames={{ input: "my-input", submit: "my-submit-button" }}
/>`;

export default function ThemingPage() {
  return (
    <>
      <h1>Theming</h1>
      <p className="lead">
        Style a form with design tokens, not one-off colours on every element. The theme becomes CSS variables on a
        single wrapper, and every field reads them.
      </p>

      <h2>The theme object</h2>
      <CodeBlock title="theme" code={THEME} />
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>CSS variable</th>
            <th>Values</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>colors.primary</code>
            </td>
            <td>
              <code>--df-primary</code>
            </td>
            <td>Any CSS colour. Used for the button, focus rings and checked states.</td>
          </tr>
          <tr>
            <td>
              <code>colors.background</code>
            </td>
            <td>
              <code>--df-bg</code>
            </td>
            <td>Form and input background. Setting it also adds inner padding to the form so text does not touch the coloured edge.</td>
          </tr>
          <tr>
            <td>
              <code>colors.text</code>
            </td>
            <td>
              <code>--df-text</code>
            </td>
            <td>Text colour.</td>
          </tr>
          <tr>
            <td>
              <code>radius</code>
            </td>
            <td>
              <code>--df-radius</code>
            </td>
            <td>none (0), sm (4px), md (8px), lg (12px), full (pill).</td>
          </tr>
          <tr>
            <td>
              <code>density</code>
            </td>
            <td>
              <code>--df-gap</code>
            </td>
            <td>compact (0.5rem), comfortable (1rem), spacious (1.5rem) between fields.</td>
          </tr>
          <tr>
            <td>
              <code>font</code>
            </td>
            <td>
              <code>--df-font</code>
            </td>
            <td>A font family name. Load the font yourself; only letters, digits, spaces and hyphens are kept.</td>
          </tr>
        </tbody>
      </table>
      <p className="callout">
        Pick a primary colour that keeps the white button text readable. Aim for a contrast ratio of at least 4.5:1
        (WCAG AA).
      </p>

      <h2>Per-field overrides</h2>
      <p>
        A field&apos;s <code>style</code> sets variables for that field only: <code>--df-field-text</code>,{" "}
        <code>--df-field-bg</code>, <code>--df-field-border</code>, <code>--df-field-radius</code> and{" "}
        <code>--df-field-font-size</code>. Reach for it as an exception, not the default.
      </p>

      <h2>Your own CSS</h2>
      <p>
        Every token has a default in <code>styles.css</code>, so you can also just override the variables:
      </p>
      <CodeBlock title="app.css" code={CSS} />
      <p>
        Other tokens you can override: <code>--df-muted</code>, <code>--df-border</code> and <code>--df-danger</code>.
      </p>

      <h2>Class names</h2>
      <p>
        Stable classes: <code>.df-form</code>, <code>.df-row</code>, <code>.df-field</code>, <code>.df-label</code>,{" "}
        <code>.df-input</code>, <code>.df-description</code>, <code>.df-error</code>, <code>.df-submit</code>. State is
        exposed through attributes (<code>aria-invalid</code>, <code>data-invalid</code> on the field,{" "}
        <code>data-state</code> on Radix parts), so you can style states without extra classes.
      </p>
      <p>
        To add your own classes per part, pass <code>classNames</code>. Available slots: <code>form</code>,{" "}
        <code>row</code>, <code>field</code>, <code>label</code>, <code>input</code>, <code>option</code>,{" "}
        <code>description</code>, <code>error</code>, <code>required</code>, <code>submit</code>.
      </p>
      <CodeBlock title="classNames" code={CLASSNAMES} />
    </>
  );
}
