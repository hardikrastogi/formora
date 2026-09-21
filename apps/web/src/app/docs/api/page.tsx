import type { Metadata } from "next";

export const metadata: Metadata = { title: "API reference" };

export default function ApiPage() {
  return (
    <>
      <h1>API reference</h1>
      <p className="lead">Everything the two packages export.</p>

      <h2>@hardikrastogi/react</h2>

      <h3>FormRenderer</h3>
      <table>
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>definition</code>
            </td>
            <td>FormDefinitionInput</td>
            <td>Required. Parsed and validated first; an invalid one renders an explanation.</td>
          </tr>
          <tr>
            <td>
              <code>onSubmit</code>
            </td>
            <td>(answers) =&gt; void | Promise</td>
            <td>Called with clean answers only when valid. Throw to show an error under the form.</td>
          </tr>
          <tr>
            <td>
              <code>registry</code>
            </td>
            <td>FieldPluginRegistry</td>
            <td>Defaults to the eight built-in types.</td>
          </tr>
          <tr>
            <td>
              <code>defaultValues</code>
            </td>
            <td>Record&lt;string, unknown&gt;</td>
            <td>Pre-fill answers, keyed by field id.</td>
          </tr>
          <tr>
            <td>
              <code>classNames</code>
            </td>
            <td>Partial slot map</td>
            <td>See theming.</td>
          </tr>
          <tr>
            <td>
              <code>submitLabel</code>, <code>disabled</code>, <code>className</code>
            </td>
            <td>string, boolean, string</td>
            <td>Button text (default &quot;Submit&quot;), disable the whole form, extra class on the form.</td>
          </tr>
        </tbody>
      </table>

      <h3>Other exports</h3>
      <ul>
        <li>
          <code>useFormRenderer(definition, options)</code>: the headless hook behind the component. Returns the parsed{" "}
          <code>definition</code>, any <code>definitionIssues</code>, the layout <code>rows</code>, the
          react-hook-form instance as <code>form</code>, <code>submit</code>, <code>submitError</code> and{" "}
          <code>isSubmitting</code>. Use it to build your own markup.
        </li>
        <li>
          <code>createDefaultRegistry()</code>: a fresh registry with the built-in types to add your own to.
        </li>
        <li>
          <code>defaultFieldPlugins</code>: the array of built-in plugins.
        </li>
        <li>
          <code>themeToCssVars(theme)</code>, <code>fieldStyleToCssVars(style, span)</code>: the theme as inline CSS
          variables.
        </li>
        <li>
          <code>collectErrors(definition, registry, answers)</code>: run the same validation the form runs.
        </li>
        <li>
          Types: <code>FieldRendererProps</code>, <code>ReactFieldPlugin</code>, <code>FormClassNames</code>,{" "}
          <code>LabelKind</code>, <code>Answers</code>.
        </li>
      </ul>

      <h2>@hardikrastogi/core</h2>
      <ul>
        <li>
          <code>FormDefinitionSchema</code>, <code>FormSubmissionSchema</code>: Zod schemas. Use{" "}
          <code>.parse</code> or <code>.safeParse</code>.
        </li>
        <li>
          <code>validateSubmission(definition, answers)</code>: returns <code>{"{ success, errors }"}</code> where{" "}
          <code>errors</code> maps field id to a list of messages.
        </li>
        <li>
          <code>FieldPluginRegistry</code>: <code>register</code>, <code>get</code>, <code>has</code>,{" "}
          <code>list</code>. Registering the same type twice throws.
        </li>
        <li>
          <code>isSubmissionCurrent(submission, definition)</code>, <code>bumpSchemaVersion(definition)</code>:
          versioning helpers.
        </li>
        <li>
          Building blocks: <code>FieldConfigSchema</code>, <code>FieldValidationSchema</code>,{" "}
          <code>FieldStyleSchema</code>, <code>LayoutSchema</code>, <code>ThemeSchema</code>, <code>LogicSchema</code>,{" "}
          <code>FIELD_ID_PATTERN</code>.
        </li>
        <li>
          Types: <code>FormDefinition</code>, <code>FormDefinitionInput</code>, <code>FormSubmission</code>,{" "}
          <code>FieldConfig</code>, <code>Theme</code>, <code>FieldTypePlugin</code> and more.
        </li>
      </ul>
    </>
  );
}
