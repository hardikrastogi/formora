"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

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
  hasMore: boolean;
  responses: ResponseRow[];
}

// Keep in sync with RESPONSES_DEFAULT_LIMIT in lib/db/responses.ts — that
// file pulls in Mongoose and can't be imported from a client component.
const PAGE_SIZE = 20;

// A plain yyyy-mm-dd is local-midnight-to-local-midnight; "to" is pushed to
// the end of that day so the whole day is included, not just its first instant.
function fromDateToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialSort = searchParams.get("sort") === "asc" ? "asc" : "desc";
  const initialSearch = searchParams.get("search") ?? "";
  const initialFrom = searchParams.get("from") ?? "";
  const initialTo = searchParams.get("to") ?? "";
  const parsedOffset = Number(searchParams.get("offset"));
  const initialOffset = Number.isInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sort, setSort] = useState<"asc" | "desc">(initialSort);
  // Plain yyyy-mm-dd, straight from a <input type="date">.
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [data, setData] = useState<ResponsesPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const restoredDepth = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Keeps the URL in step with what's currently loaded, so a refresh, or the
  // back/forward buttons, land back on the same filters and the same depth
  // scrolled to — instead of always resetting to the first page.
  const syncUrl = useCallback(
    (nextSearch: string, nextSort: "asc" | "desc", nextFrom: string, nextTo: string, loadedCount: number) => {
      const params = new URLSearchParams();
      if (nextSearch) params.set("search", nextSearch);
      if (nextSort === "asc") params.set("sort", "asc");
      if (nextFrom) params.set("from", nextFrom);
      if (nextTo) params.set("to", nextTo);
      if (loadedCount > PAGE_SIZE) params.set("offset", String(loadedCount));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      // First run only: if the URL says we'd scrolled N deep, re-fetch that
      // same depth in one request rather than snapping back to page one.
      const restoreDepth = !restoredDepth.current && initialOffset > 0;
      restoredDepth.current = true;
      const limit = restoreDepth ? initialOffset + PAGE_SIZE : PAGE_SIZE;
      try {
        const params = new URLSearchParams({ sort, offset: "0", limit: String(limit) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const from = fromDateToIso(fromDate);
        if (from) params.set("from", from);
        const to = toDateToIso(toDate);
        if (to) params.set("to", to);
        const res = await fetch(`/api/forms/${slug}/responses?${params}`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load responses.");
        const page = (await res.json()) as ResponsesPageData;
        if (!cancelled) {
          setData(page);
          syncUrl(debouncedSearch, sort, fromDate, toDate, page.responses.length);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load responses.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // initialOffset and syncUrl are intentionally not deps: this effect should
    // only re-run when the actual filters change, not on every URL sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, debouncedSearch, sort, fromDate, toDate]);

  const loadMore = useCallback(async () => {
    if (!data || !data.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        sort,
        offset: String(data.responses.length),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const from = fromDateToIso(fromDate);
      if (from) params.set("from", from);
      const to = toDateToIso(toDate);
      if (to) params.set("to", to);
      const res = await fetch(`/api/forms/${slug}/responses?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load more responses.");
      const page = (await res.json()) as ResponsesPageData;
      setData((prev) => {
        const merged = prev ? { ...page, responses: [...prev.responses, ...page.responses] } : page;
        syncUrl(debouncedSearch, sort, fromDate, toDate, merged.responses.length);
        return merged;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more responses.");
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, sort, debouncedSearch, fromDate, toDate, slug, syncUrl]);

  // Infinite scroll: fetch the next page as soon as the sentinel below the
  // list scrolls into view, instead of requiring an explicit click.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !data?.hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [data?.hasMore, loadMore]);

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
        <label htmlFor="responses-from" className="sr-only">
          From date
        </label>
        <input
          id="responses-from"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          max={toDate || undefined}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <label htmlFor="responses-to" className="sr-only">
          To date
        </label>
        <input
          id="responses-to"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          min={fromDate || undefined}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        {fromDate || toDate ? (
          <button
            type="button"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Clear dates
          </button>
        ) : null}
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
          {fromDate || toDate
            ? "No responses match your filters."
            : debouncedSearch
              ? "No responses match your search."
              : "No responses yet."}
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
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{new Date(response.submittedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</span>
                    {response.verified ? <Badge variant="secondary">verified email</Badge> : null}
                    {response.revisionNumber > 1 ? (
                      <Badge variant="outline">edited (rev {response.revisionNumber})</Badge>
                    ) : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {data?.hasMore ? (
        <div ref={sentinelRef} role="status" className="mt-4 py-4 text-center text-sm text-muted-foreground">
          {loadingMore ? "Loading more…" : null}
        </div>
      ) : null}
    </div>
  );
}
