import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

const TITLE_WORDS = ["Forms", "as", "data."];

// A fixed row count paired with hero-boxes' fixed 40-column grid — generous
// enough to cover the overscanned, perspective-scaled area without a
// client-side resize listener.
const BOX_COUNT = 40 * 36;

const USE_CASES = [
  {
    number: "01",
    title: "Registration and RSVP",
    body: "Publish a focused form for events, workshops, waitlists, or guest confirmations and share it anywhere.",
  },
  {
    number: "02",
    title: "Feedback and intake",
    body: "Collect structured feedback, client requirements, applications, or internal requests without rebuilding the flow.",
  },
  {
    number: "03",
    title: "Forms inside your product",
    body: "Bring the same builder and renderer into your own React application while keeping control of the experience and data.",
  },
];

const UPCOMING_TEMPLATES = [
  ["Event RSVP", "Guests, attendance, and plus-ones"],
  ["Job application", "Candidates and role-specific questions"],
  ["Client intake", "Project details before the first call"],
  ["Product feedback", "Structured insight from real users"],
  ["Workshop signup", "Registration, capacity, and preferences"],
  ["Contact form", "A polished starting point for enquiries"],
];

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero-bg relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 text-center">
        <div aria-hidden="true" className="hero-boxes-mask">
          <div className="hero-boxes">
            {Array.from({ length: BOX_COUNT }, (_, i) => (
              <div key={i} />
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-2xl">
          <p className="hero-blend mb-3 text-sm font-medium text-muted-foreground">
            Open source · npm packages · any React app
          </p>
          <h1 className="hero-blend text-5xl font-bold tracking-tight md:text-7xl">
            {TITLE_WORDS.map((word, i) => (
              <span key={word} className="hero-word" style={{ animationDelay: `${i * 110}ms` }}>
                {word}
                {i < TITLE_WORDS.length - 1 ? " " : ""}
              </span>
            ))}
          </h1>
          <p
            className="hero-blend hero-word mx-auto mt-5 max-w-xl text-lg text-muted-foreground"
            style={{ animationDelay: `${TITLE_WORDS.length * 110}ms` }}
          >
            Describe a form as one JSON document. Formora validates it, renders it, themes it, and checks the answers —
            so you stop hand-building forms.
          </p>
          <div
            className="hero-word relative z-10 mt-8 flex flex-wrap justify-center gap-3"
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

      <section className="border-t px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Built for real work</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">One form system. Many ways to use it.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Start with a shareable form or make Formora part of a larger product. The structure stays portable while
              the experience fits the job.
            </p>
          </div>

          <div className="mt-12 grid border-y md:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <article
                key={useCase.number}
                className="border-b py-8 last:border-b-0 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
              >
                <span className="font-mono text-xs text-muted-foreground">{useCase.number}</span>
                <h3 className="mt-10 text-xl font-semibold tracking-tight">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{useCase.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Coming next</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">Start with a proven structure.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Upcoming templates will turn common workflows into a useful starting point—not a rigid final form.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {UPCOMING_TEMPLATES.map(([title, description], index) => (
              <article
                key={title}
                className="min-h-48 bg-[var(--home-background)] p-6 transition-colors hover:bg-background/70"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  <span className="rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Upcoming
                  </span>
                </div>
                <h3 className="mt-14 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t px-4 py-20 text-center md:py-28">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Start from a blank canvas</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">Build the form your workflow actually needs.</h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            Explore the builder now. Templates will make the first step faster; Formora already gives you control over
            everything after it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Create an account
            </Link>
            <Link href="/playground" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Explore the playground
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
