"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Entry = { slug: string; order: number; title: string; status?: string };
type Result = Entry & { excerpt: string; matchedBy: string };

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.isContentEditable;
}

export function CommandPalette({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "/" && !open && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (!open) return;
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
        router.push(`/progress/${results[selected].slug}`);
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, results, router, selected]);

  useEffect(() => {
    if (!open) return;
    setSelected(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const needle = query.trim();
    if (!needle) {
      setResults(entries.slice(0, 8).map((entry) => ({ ...entry, excerpt: "Research note", matchedBy: "note" })));
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(needle)}`, { signal: controller.signal });
        const data = await response.json();
        setResults(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [entries, open, query]);

  function openResult(result: Result) {
    router.push(`/progress/${result.slug}`);
    setOpen(false);
  }

  return (
    <>
      <button className="search-trigger" onClick={() => setOpen(true)} aria-label="Search research notes">
        <span>⌕ Search</span><kbd>⌘K</kbd>
      </button>
      {open && (
        <div className="command-palette" role="dialog" aria-modal="true" aria-label="Search research">
          <button className="palette-backdrop" onClick={() => setOpen(false)} aria-label="Close search" />
          <div className="palette-dialog">
            <div className="palette-input">
              <span aria-hidden="true">⌕</span>
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, headings, tags, content…" aria-label="Search research" />
              <kbd>ESC</kbd>
            </div>
            <div className="palette-results" role="listbox">
              {loading && <p className="palette-state">Searching…</p>}
              {!loading && results.map((result, index) => (
                <button
                  key={result.slug}
                  className={`palette-result ${index === selected ? "selected" : ""}`}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => openResult(result)}
                  role="option"
                  aria-selected={index === selected}
                >
                  <span className="palette-number">{String(result.order).padStart(2, "0")}</span>
                  <span className="palette-copy">
                    <strong>{result.title}</strong>
                    <small>{result.excerpt}</small>
                  </span>
                  <span className="palette-kind">{result.matchedBy}</span>
                </button>
              ))}
              {!loading && !results.length && <p className="palette-state">No matching research found.</p>}
            </div>
            <div className="palette-hint"><span>↑↓ navigate</span><span>↵ open</span><span>/ search</span></div>
          </div>
        </div>
      )}
    </>
  );
}
