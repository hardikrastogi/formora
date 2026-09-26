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

      <h2>@hardikrastogi/react/server</h2>
      <p>
        A separate, server-safe entry point with no React in it. The main entry is a client bundle, and frameworks
        such as Next.js refuse to load anything from it in server code, so server checks live here instead.
      </p>
      <ul>
        <li>
          <code>collectServerErrors(definition, answers)</code>: returns <code>{"{ [fieldId]: string[] }"}</code>.
          Runs core&apos;s required, length, range and pattern rules plus the email and URL format checks, the same
          combination the form runs in the browser. An empty object means the answers are valid. A custom field type
          that only exists in the browser cannot be re-checked here.
        </li>
      </ul>

      <h2>@hardikrastogi/builder</h2>
      <ul>
        <li>
          <code>Builder</code>: the editor. Props: <code>initialDefinition</code> (required), <code>storageKey</code>,{" "}
          <code>onPublish</code>, <code>onUnpublish</code>, <code>initialPublished</code>. See the{" "}
          <a href="/docs/builder">builder page</a> for what each does.
        </li>
        <li>
          <code>createBlankDefinition(id, name?)</code>: an empty <code>FormDefinition</code> to start from.
        </li>
        <li>
          <code>loadFromStorage(key)</code>: reads a definition the builder autosaved to local storage, or{" "}
          <code>null</code>.
        </li>
        <li>
          <code>FIELD_CATALOG</code>, <code>FIELD_CATEGORIES</code>, <code>fieldMetaFor(type)</code>: the field types
          shown in the palette.
        </li>
        <li>
          <code>createBuilderStore</code>, <code>BuilderProvider</code>, <code>useBuilder(selector)</code>: the state
          behind the editor, for building your own UI around it.
        </li>
        <li>
          <code>contrastAgainstWhite(hex)</code>, <code>WCAG_AA_NORMAL_TEXT</code>: the accessibility contrast check
          used on the theme colour.
        </li>
        <li>
          Types: <code>BuilderProps</code>, <code>PublishResult</code>, <code>PublishState</code>,{" "}
          <code>BuilderStore</code>, <code>FieldTypeMeta</code>.
        </li>
      </ul>
    </>
  );
}
