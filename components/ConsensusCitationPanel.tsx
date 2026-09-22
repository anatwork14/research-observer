"use client";

import { useEffect, useRef, useState } from "react";
import { consensusMarkdownCitation, consensusReference } from "@/lib/consensus/citation.mjs";

type Paper = {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  journal: string;
  doi?: string;
  url: string;
  abstract?: string;
  takeaway?: string;
  studyType?: string;
  citationCount?: number;
  fullTextChunks: Array<{ text: string; section?: string }>;
};

type Status = { enabled: boolean; reason?: string };

function authorLine(paper: Paper) {
  if (!paper.authors.length) return "Authors unavailable";
  return paper.authors.length > 3
    ? paper.authors.slice(0, 3).join(", ") + " et al."
    : paper.authors.join(", ");
}

function fallbackCopy(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access is unavailable.");
}

export function ConsensusCitationPanel({
  defaultQuery,
  embedded = false,
  onStatusChange,
}: {
  defaultQuery: string;
  embedded?: boolean;
  onStatusChange?: (status: Status) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [query, setQuery] = useState(defaultQuery);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const searchController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/consensus/search", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        const next = { enabled: Boolean(payload.enabled), reason: payload.reason };
        setStatus(next);
        onStatusChange?.(next);
      })
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          const next = { enabled: false, reason: "Consensus status is unavailable." };
          setStatus(next);
          onStatusChange?.(next);
        }
      });
    return () => {
      controller.abort();
      searchController.current?.abort();
    };
  }, [onStatusChange]);

  function applyPrompt(kind: "support" | "challenge" | "review") {
    const base = defaultQuery.trim();
    const suffix =
      kind === "support"
        ? " supporting evidence"
        : kind === "challenge"
          ? " contradictory evidence limitations"
          : " systematic review meta-analysis recent evidence";
    setQuery((base || query.trim()) + suffix);
  }

  async function runSearch() {
    const nextQuery = query.trim();
    if (!nextQuery || searching || !status?.enabled) return;

    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setSearching(true);
    setSearched(true);
    setLastQuery(nextQuery);
    setError("");

    try {
      const response = await fetch("/api/consensus/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query: nextQuery,
          pageSize: 6,
          excludePreprints: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Consensus search failed.");
      setPapers(Array.isArray(payload.papers) ? payload.papers : []);
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") {
        setError(requestError instanceof Error ? requestError.message : "Consensus search failed.");
      }
    } finally {
      if (searchController.current === controller) {
        searchController.current = null;
        setSearching(false);
      }
    }
  }

  async function copy(kind: "reference" | "markdown", paper: Paper) {
    const value = kind === "reference" ? consensusReference(paper) : consensusMarkdownCitation(paper);
    const key = `${kind}-${paper.id || paper.url}`;
    setError("");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else fallbackCopy(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? "" : current), 1400);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Could not copy the citation.");
    }
  }

  return (
    <section className={`consensus-citation-panel ${embedded ? "embedded" : ""}`} aria-label="Consensus citations">
      {!embedded && (
        <div className="consensus-citation-heading">
          <div>
            <span className="consensus-mark" aria-hidden="true">C</span>
            <div><strong>Consensus</strong><small>Peer-reviewed citations</small></div>
          </div>
          <span className={`codex-status ${status?.enabled ? "ready" : ""}`}>
            {status === null ? "checking" : status.enabled ? "ready" : "offline"}
          </span>
        </div>
      )}

      <div className="assist-section-heading">
        <div>
          <span className="kicker">Literature search</span>
          <strong>Find sources for this note</strong>
        </div>
        {searched && !searching && <span>{papers.length} result{papers.length === 1 ? "" : "s"}</span>}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="consensus-citation-search">
        <label>
          <span className="sr-only">Consensus citation query</span>
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={3}
            aria-label="Consensus citation query"
            placeholder="Describe the evidence you need…"
            disabled={!status?.enabled || searching}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void runSearch();
              }
            }}
          />
        </label>
        <div className="assist-quick-actions" aria-label="Consensus query helpers">
          <button type="button" onClick={() => applyPrompt("support")} disabled={!status?.enabled || searching}>Support</button>
          <button type="button" onClick={() => applyPrompt("challenge")} disabled={!status?.enabled || searching}>Challenge</button>
          <button type="button" onClick={() => applyPrompt("review")} disabled={!status?.enabled || searching}>Reviews</button>
        </div>
        <div className="consensus-search-actions">
          <span>⌘/Ctrl + Enter</span>
          <button type="submit" disabled={!status?.enabled || searching || !query.trim()}>
            {searching ? <><span className="assist-spinner" aria-hidden="true" />Searching…</> : "Search literature"}
          </button>
        </div>
      </form>

      {status && !status.enabled && (
        <div className="assist-state-card muted">
          <strong>Consensus is unavailable</strong>
          <p>{status.reason}</p>
        </div>
      )}

      {error && (
        <div className="assist-state-card error" role="alert">
          <strong>Search needs attention</strong>
          <p>{error}</p>
          {lastQuery && status?.enabled && <button type="button" onClick={() => void runSearch()}>Retry</button>}
        </div>
      )}

      {searching && (
        <div className="assist-result-skeleton" aria-label="Searching Consensus">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index}>
              <span className="skeleton-block title" />
              <span className="skeleton-block line" />
              <span className="skeleton-block line short" />
            </div>
          ))}
        </div>
      )}

      {searched && !searching && !error && papers.length === 0 && (
        <div className="assist-state-card">
          <strong>No papers returned</strong>
          <p>Broaden the question, remove a constraint, or try a review-oriented query.</p>
        </div>
      )}

      {papers.length > 0 && !searching && (
        <div className="consensus-citation-results" aria-live="polite">
          <div className="assist-results-label">
            <span>Results for</span>
            <strong>“{lastQuery}”</strong>
          </div>
          {papers.map((paper, index) => {
            const id = paper.id || paper.url;
            const summary = paper.takeaway || paper.abstract;
            return (
              <article key={id} className="consensus-citation-result">
                <div className="consensus-result-topline">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div className="consensus-citation-meta">
                    {paper.studyType && <span>{paper.studyType}</span>}
                    {paper.citationCount !== undefined && <span>{paper.citationCount.toLocaleString()} citations</span>}
                    {paper.doi && <span>DOI</span>}
                  </div>
                </div>

                <a href={paper.url} target="_blank" rel="noreferrer">{paper.title}</a>
                <small>{authorLine(paper)}{paper.year ? ` · ${paper.year}` : ""}{paper.journal ? ` · ${paper.journal}` : ""}</small>

                {summary && (
                  <details className="consensus-result-details">
                    <summary>Why this may be relevant</summary>
                    <p>{summary}</p>
                  </details>
                )}

                <div className="consensus-citation-actions">
                  <a href={paper.url} target="_blank" rel="noreferrer">Open source ↗</a>
                  <button type="button" onClick={() => void copy("reference", paper)}>
                    {copied === `reference-${id}` ? "Copied ✓" : "Copy reference"}
                  </button>
                  <button type="button" onClick={() => void copy("markdown", paper)}>
                    {copied === `markdown-${id}` ? "Copied ✓" : "Copy Markdown"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="assist-integrity-note">
        Search order, semantic relevance, and citation counts are discovery signals—not proof of a claim.
      </p>
    </section>
  );
}
