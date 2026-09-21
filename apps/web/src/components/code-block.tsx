import { CopyButton } from "./copy-button";

export function CodeBlock({ code, title }: { code: string; title?: string }) {
  const text = code.replace(/^\n+|\s+$/g, "");
  return (
    <figure className="mb-4 overflow-hidden rounded-lg border bg-muted/40">
      <figcaption className="flex items-center justify-between border-b bg-muted px-3 py-1.5 text-xs text-foreground/80">
        <span>{title ?? ""}</span>
        <CopyButton text={text} />
      </figcaption>
      <pre
        tabIndex={0}
        role="region"
        aria-label={title ? title + " code" : "Code"}
        className="overflow-x-auto p-4 text-sm leading-relaxed"
      >
        <code className="font-mono">{text}</code>
      </pre>
    </figure>
  );
}
