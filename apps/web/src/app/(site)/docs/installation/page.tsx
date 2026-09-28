import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = { title: "Installation" };

export default function InstallationPage() {
  return (
    <>
      <h1>Installation</h1>
      <p className="lead">Two packages, and React 18 or newer in your app.</p>

      <h2>Install</h2>
      <CodeBlock title="npm" code={"npm install @hardikrastogi/core @hardikrastogi/react"} />
      <CodeBlock title="pnpm" code={"pnpm add @hardikrastogi/core @hardikrastogi/react"} />
      <CodeBlock title="yarn" code={"yarn add @hardikrastogi/core @hardikrastogi/react"} />
      <p>
        <code>react</code> and <code>react-dom</code> are peer dependencies: your app supplies them, so there is only
        ever one copy of React. If you only need validation on a server, install just{" "}
        <code>@hardikrastogi/core</code>.
      </p>

      <h2>Import the stylesheet once</h2>
      <p>
        The renderer ships a small stylesheet that gives fields sensible defaults. Import it once, near the root of
        your app.
      </p>
      <CodeBlock title="main.tsx" code={'import "@hardikrastogi/react/styles.css";'} />
      <p>
        It only defines <code>.df-*</code> classes and CSS variables, so it will not collide with your own styles. You
        can skip it entirely and style the classes yourself.
      </p>

      <h2>Works in any React app</h2>
      <p>
        There are no framework-specific imports. It runs in Vite, Create React App, Remix and Next.js. The components
        are marked <code>&quot;use client&quot;</code>, so in the Next.js App Router you can import them straight into
        a server component file and they render on the client.
      </p>

      <h2>TypeScript</h2>
      <p>
        Type declarations are included. Definitions are validated at runtime, and the input type is{" "}
        <code>FormDefinitionInput</code> from <code>@hardikrastogi/core</code>.
      </p>
    </>
  );
}
