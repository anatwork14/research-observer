"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function CollectionFilters({
  query = "",
  type = "",
  typeOptions = [],
  status = "",
  statusOptions = [],
  placeholder = "Search this collection…",
}: {
  query?: string;
  type?: string;
  typeOptions?: Array<{ value: string; label: string }>;
  status?: string;
  statusOptions?: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQuery = useRef(query);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function apply(key: string, value: string, immediate = false) {
    const hasPendingSearch = Boolean(timer.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const update = () => {
      const params = new URLSearchParams(searchParams.toString());
      if (key !== "q" && hasPendingSearch) params.set("q", pendingQuery.current);
      if (value) params.set(key, value);
      else params.delete(key);
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    };
    if (immediate) update();
    else timer.current = setTimeout(update, 180);
  }

  return (
    <div className="collection-filters" role="search">
      <label className="collection-search-label">
        <span className="sr-only">Filter collection</span>
        <input ref={searchInput} type="search" aria-label="Filter collection" placeholder={placeholder} defaultValue={query} onChange={(event) => { pendingQuery.current = event.target.value; apply("q", event.target.value); }} />
      </label>
      {typeOptions.length > 0 && (
        <label className="collection-type-filter">
          <span>Type</span>
          <select aria-label="Filter by type" value={type} onChange={(event) => apply("type", event.target.value, true)}>
            <option value="">All types</option>
            {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      )}
      {statusOptions.length > 0 && (
        <label className="collection-type-filter">
          <span>Status</span>
          <select aria-label="Filter by status" value={status} onChange={(event) => apply("status", event.target.value, true)}>
            <option value="">All statuses</option>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      )}
      {(query || type || status) && <button type="button" className="collection-filter-clear" onClick={() => {
        if (timer.current) clearTimeout(timer.current);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("q");
        params.delete("type");
        params.delete("status");
        pendingQuery.current = "";
        if (searchInput.current) searchInput.current.value = "";
        const next = params.toString();
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      }}>Clear filters</button>}
    </div>
  );
}
