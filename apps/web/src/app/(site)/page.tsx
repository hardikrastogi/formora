import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

const TITLE_WORDS = ["Forms", "as", "data."];

export default function HomePage() {
  return (
    <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 text-center">
      <div aria-hidden="true" className="hero-dotgrid" />
      <div className="relative z-10 mx-auto max-w-2xl">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Open source · npm packages · any React app</p>
        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
          {TITLE_WORDS.map((word, i) => (
            <span key={word} className="hero-word" style={{ animationDelay: `${i * 110}ms` }}>
              {word}
              {i < TITLE_WORDS.length - 1 ? " " : ""}
            </span>
          ))}
        </h1>
        <p
          className="hero-word mx-auto mt-5 max-w-xl text-lg text-muted-foreground"
          style={{ animationDelay: `${TITLE_WORDS.length * 110}ms` }}
        >
          Describe a form as one JSON document. Formora validates it, renders it, themes it, and checks the answers —
          so you stop hand-building forms.
        </p>
        <div
          className="hero-word mt-8 flex flex-wrap justify-center gap-3"
          style={{ animationDelay: `${(TITLE_WORDS.length + 1) * 110}ms` }}
        >
          <Link href="/playground" className={cn(buttonVariants({ size: "lg" }), "cta-glow")}>
            Try the playground
          </Link>
          <Link href="/docs" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}
