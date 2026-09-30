"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface FieldMeta {
  id: string;
  label: string;
  type: string;
}

interface ResponseRow {
  id: string;
  submittedAt: string;
  updatedAt: string;
  revisionNumber: number;
  verified: boolean;
  answers: Record<string, unknown>;
}

interface ResponsesPageData {
  fields: FieldMeta[];
  totalCount: number;
  nextCursor: string | null;
  responses: ResponseRow[];
}

function previewOf(answers: Record<string, unknown>, fields: FieldMeta[]): string {
  for (const field of fields) {
    const value = answers[field.id];
    if (value === null || value === undefined || value === "") continue;
    return Array.isArray(value) ? value.join(", ") : String(value);
  }
  return "(no answers)";
}

export function ResponsesList({ slug }: { slug: string }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<ResponsesPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const params = new URLSearchParams({ sort });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/forms/${slug}/responses?${params}`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load responses.");
        const page = (await res.json()) as ResponsesPageData;
        if (!cancelled) setData(page);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load responses.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, debouncedSearch, sort]);

  async function loadMore() {
    if (!data?.nextCursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, cursor: data.nextCursor });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/forms/${slug}/responses?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load more responses.");
      const page = (await res.json()) as ResponsesPageData;
      setData((prev) => (prev ? { ...page, responses: [...prev.responses, ...page.responses] } : page));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more responses.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search responses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search responses"
          className="w-64 rounded-md border bg-background px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => setSort((s) => (s === "desc" ? "asc" : "desc"))}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          {sort === "desc" ? "Newest first" : "Oldest first"}
        </button>
        {data ? (
          <span className="text-sm text-muted-foreground">
            {data.totalCount} response{data.totalCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data === null && !error ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : null}

      {data && data.responses.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {debouncedSearch ? "No responses match your search." : "No responses yet."}
        </p>
      ) : null}

      {data && data.responses.length > 0 ? (
        <ul className="mt-4 divide-y rounded-md border">
          {data.responses.map((response) => (
            <li key={response.id}>
              <Link
                href={`/forms/${slug}/responses/${response.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{previewOf(response.answers, data.fields)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(response.submittedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                    {response.verified ? " · verified email" : ""}
                    {response.revisionNumber > 1 ? ` · edited (rev ${response.revisionNumber})` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {data?.nextCursor ? (
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
