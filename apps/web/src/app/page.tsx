import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { buttonVariants } from "@/components/ui/button";

const SNIPPET = `import { FormRenderer } from "@hardikrastogi/react";
import "@hardikrastogi/react/styles.css";

<FormRenderer
  definition={definition}
  onSubmit={(answers) => save(answers)}
/>`;

const FEATURES = [
  {
    title: "The JSON is the product",
    body: "One FormDefinition describes fields, layout, theme and rules. The renderer, the validator and your storage all read the same document.",
  },
  {
    title: "Tokens, not hex codes",
    body: "A theme of colours, radius, font and density becomes CSS variables. Restyle every field at once, and override one field when you must.",
  },
  {
    title: "Field types are plugins",
    body: "Eight are built in. Register your own with a name, a schema and a component, then use it from JSON like any other.",
  },
  {
    title: "Validated on both sides",
    body: "The rules live in a UI-free package, so the exact checks the browser runs also run on your server.",
  },
];

const STEPS = [
  ["Describe", "Write a FormDefinition as JSON, or produce one from your own tools."],
  ["Render", "Pass it to FormRenderer. Fields, grid, theme and validation come from the definition."],
  ["Collect", "Receive clean answers plus the schema version, ready to store or send."],
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 text-center md:pt-24">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Open source · npm packages · any React app</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">Forms as data.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Describe a form as one JSON document. Formora validates it, renders it, themes it and checks the answers, so
          you stop hand-building forms.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/playground" className={buttonVariants({ size: "lg" })}>
            Try the playground
          </Link>
          <Link href="/docs" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Read the docs
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-16">
        <CodeBlock title="Install" code={"npm install @hardikrastogi/core @hardikrastogi/react"} />
        <CodeBlock title="Use" code={SNIPPET} />
      </section>

      <section className="border-y bg-muted/30 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="rounded-lg border bg-background p-5">
                <span className="text-sm font-medium text-muted-foreground">Step {i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">Built to be depended on</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border p-5">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
          Formora is early and versioned 0.x. A drag-and-drop builder and hosted, shareable forms are planned next; the
          packages you can use today are the schema and the renderer.
        </p>
      </section>
    </>
  );
}
