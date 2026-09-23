"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type NavEntry = { slug: string; order: number; title: string; status?: string };
type SearchEntry = NavEntry & {
  summary: string;
  type?: string;
  date?: string;
  research?: string;
  tags: string[];
  headings: Array<{ level: number; title: string }>;
  text: string;
};
type Result = NavEntry & { excerpt: string; matchedBy: string };

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.isContentEditable;
}

function parseQuery(query: string) {
  const filters: Record<string, string[]> = {};
  const words: string[] = [];
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const match = token.match(/^(type|status|tag|research|project):(.+)$/i);
    if (match) {
      const key = match[1].toLowerCase();
      filters[key] = [...(filters[key] ?? []), match[2].toLowerCase()];
    } else {
      words.push(token);
    }
  }
  return { filters, text: words.join(" ").toLowerCase() };
}

function excerptAround(text: string, needle: string) {
  if (!text) return "";
  if (!needle) return text.slice(0, 140) + (text.length > 140 ? "…" : "");
  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return text.slice(0, 140) + (text.length > 140 ? "…" : "");
  const start = Math.max(0, index - 55);
  const end = Math.min(text.length, index + needle.length + 85);
  return (start ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function initialResults(entries: NavEntry[]): Result[] {
  return entries.slice(0, 8).map((entry) => ({
    ...entry,
    excerpt: "Research note",
    matchedBy: "note",
  }));
}

function runSearch(entries: SearchEntry[], query: string): Result[] {
  const { filters, text } = parseQuery(query);

  return entries
    .filter((entry) => {
      if (filters.type?.length && !entry.type) return false;
      if (filters.type?.length && !filters.type.includes((entry.type ?? "").toLowerCase())) return false;
      if (filters.status?.length && !entry.status) return false;
      if (filters.status?.length && !filters.status.includes((entry.status ?? "").toLowerCase())) return false;
      const researchFilters = [...(filters.research ?? []), ...(filters.project ?? [])];
      if (researchFilters.length && !researchFilters.includes((entry.research ?? "default").toLowerCase())) return false;
      if (filters.tag?.length && !filters.tag.every((tag) => entry.tags.map((item) => item.toLowerCase()).includes(tag))) return false;
      return true;
    })
    .map((entry) => {
      if (!text) return { entry, score: 1, matchedBy: "filter", excerpt: entry.summary || "Research note" };

      const title = entry.title.toLowerCase();
      const summary = entry.summary.toLowerCase();
      const tags = entry.tags.join(" ").toLowerCase();
      const status = (entry.status ?? "").toLowerCase();
      const type = (entry.type ?? "").toLowerCase();
      const research = (entry.research ?? "default").toLowerCase();
      const headingText = entry.headings.map((heading) => heading.title).join(" ").toLowerCase();
      const body = entry.text.toLowerCase();

      let score = 0;
      let matchedBy = "content";
      if (title === text) { score += 140; matchedBy = "title"; }
      else if (title.startsWith(text)) { score += 100; matchedBy = "title"; }
      else if (title.includes(text)) { score += 80; matchedBy = "title"; }
      if (tags.includes(text)) { score += 50; if (matchedBy === "content") matchedBy = "tag"; }
      if (type.includes(text)) { score += 45; if (matchedBy === "content") matchedBy = "type"; }
      if (status.includes(text)) { score += 40; if (matchedBy === "content") matchedBy = "status"; }
      if (research.includes(text)) { score += 38; if (matchedBy === "content") matchedBy = "research"; }
      if (headingText.includes(text)) { score += 35; if (matchedBy === "content") matchedBy = "heading"; }
      if (summary.includes(text)) { score += 30; if (matchedBy === "content") matchedBy = "summary"; }
      if (body.includes(text)) score += 15;

      return {
        entry,
        score,
        matchedBy,
        excerpt: excerptAround(matchedBy === "summary" ? entry.summary : entry.text, text),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.order - b.entry.order)
    .slice(0, 12)
    .map(({ entry, excerpt, matchedBy }) => ({
      slug: entry.slug,
      order: entry.order,
      title: entry.title,
      status: entry.status,
      excerpt,
      matchedBy,
    }));
}

function runFallbackSearch(entries: NavEntry[], query: string): Result[] {
  const { filters, text } = parseQuery(query);
  if (filters.type?.length || filters.tag?.length || filters.research?.length || filters.project?.length) return [];

  return entries
    .filter((entry) => {
      if (filters.status?.length && !filters.status.includes((entry.status ?? "").toLowerCase())) return false;
      if (!text) return true;
      return entry.title.toLowerCase().includes(text) || (entry.status ?? "").toLowerCase().includes(text);
    })
    .slice(0, 12)
    .map((entry) => ({
      ...entry,
      excerpt: entry.status ? `Status: ${entry.status}` : "Research note",
      matchedBy: text ? "title/status" : filters.status?.length ? "status" : "note",
    }));
}

function currentResults(entries: NavEntry[], index: SearchEntry[] | null, indexUnavailable: boolean, query: string) {
  if (indexUnavailable) return runFallbackSearch(entries, query);
  if (!index) return initialResults(entries);
  return runSearch(index, query);
}

export function CommandPalette({ entries }: { entries: NavEntry[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [indexUnavailable, setIndexUnavailable] = useState(false);
  const [selected, setSelected] = useState(0);

  function openPalette() {
    setSelected(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "/" && !open && !isTypingTarget(event.target)) {
        event.preventDefault();
        openPalette();
        return;
      }
      if (!open) return;
      const results = currentResults(entries, index, indexUnavailable, query);
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((value) => Math.min(value + 1, Math.max(0, results.length - 1)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((value) => Math.max(0, value - 1));
      } else if (event.key === "Enter" && results[selected]) {
        event.preventDefault();
        router.push("/progress/" + results[selected].slug);
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entries, index, indexUnavailable, open, query, router, selected]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());

    setIndexUnavailable(false);
    const controller = new AbortController();
    fetch("/_research/search.json?ts=" + Date.now(), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Search index unavailable");
        return response.json();
      })
      .then((payload) => {
        setIndex(Array.isArray(payload.entries) ? payload.entries : []);
        setIndexUnavailable(false);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setIndex(null);
          setIndexUnavailable(true);
        }
      });

    return () => controller.abort();
  }, [open]);

  const results = useMemo(
    () => currentResults(entries, index, indexUnavailable, query),
    [entries, index, indexUnavailable, query],
  );

  function openResult(result: Result) {
    router.push("/progress/" + result.slug);
    setOpen(false);
  }

  return (
    <>
      <button className="search-trigger" onClick={openPalette} aria-label="Search research notes">
        <span>⌕ Search</span><kbd>⌘K</kbd>
      </button>
      {open && (
        <div className="command-palette" role="dialog" aria-modal="true" aria-label="Search research">
          <button className="palette-backdrop" onClick={() => setOpen(false)} aria-label="Close search" />
          <div className="palette-dialog">
            <div className="palette-input">
              <span aria-hidden="true">⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
                placeholder={indexUnavailable ? "Search note title/status…" : "Search or filter: research:retrieval type:experiment…"}
                aria-label="Search research"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="palette-results" role="listbox">
              {index === null && !indexUnavailable && (
                <div className="palette-skeleton" aria-label="Loading research index" aria-busy="true">
                  {Array.from({ length: 5 }, (_, row) => (
                    <div className="palette-skeleton-row" key={row}>
                      <span className="skeleton-block palette-skeleton-number" />
                      <span className="palette-skeleton-copy">
                        <span className="skeleton-block" />
                        <span className="skeleton-block short" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {indexUnavailable && (
                <p className="palette-state" role="status">Full research index unavailable. Falling back to note title/status search.</p>
              )}
              {results.map((result, resultIndex) => (
                <button
                  key={result.slug}
                  className={"palette-result " + (resultIndex === selected ? "selected" : "")}
                  onMouseEnter={() => setSelected(resultIndex)}
                  onClick={() => openResult(result)}
                  role="option"
                  aria-selected={resultIndex === selected}
                >
                  <span className="palette-number">{String(result.order).padStart(2, "0")}</span>
                  <span className="palette-copy">
                    <strong>{result.title}</strong>
                    <small>{result.excerpt}</small>
                  </span>
                  <span className="palette-kind">{result.matchedBy}</span>
                </button>
              ))}
              {index !== null && !indexUnavailable && !results.length && <p className="palette-state">No matching research found.</p>}
              {indexUnavailable && !results.length && <p className="palette-state">No note title/status matches this fallback search.</p>}
            </div>
            <div className="palette-hint">
              <span>↑↓ navigate</span><span>↵ open</span><span>{indexUnavailable ? "fallback: title + status" : "research: · type: · status: · tag:"}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
