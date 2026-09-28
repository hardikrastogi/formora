import { DocsNav } from "@/components/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="md:sticky md:top-20 md:self-start">
        <DocsNav />
      </aside>
      <article className="docs-prose min-w-0">{children}</article>
    </div>
  );
}
