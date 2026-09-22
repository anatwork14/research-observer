"use client";

import { useEffect, useState } from "react";
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

function reference(paper: Paper) {
  const authors = paper.authors.length
    ? paper.authors.length <= 3 ? paper.authors.join(", ") : paper.authors.slice(0, 3).join(", ") + " et al."
    : "Unknown authors";
  const year = paper.year ?? "n.d.";
  const url = paper.doi ? `https://doi.org/${paper.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : paper.url;
  return [`${authors} (${year}). ${paper.title}.`, paper.journal ? `${paper.journal}.` : "", url].filter(Boolean).join(" ");
}

function markdownCitation(paper: Paper) {
  const authors = paper.authors.length
    ? paper.authors.length <= 2 ? paper.authors.join(" & ") : paper.authors[0] + " et al."
    : "Unknown authors";
  const year = paper.year ?? "n.d.";
  const url = paper.doi ? `https://doi.org/${paper.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : paper.url;
  return `[${paper.title}](${url}) — ${authors} (${year}).`;
}

export function ConsensusCitationPanel({
  defaultQuery,
}: {
  defaultQuery: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [query, setQuery] = useState(defaultQuery);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/consensus/search", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setStatus({ enabled: Boolean(payload.enabled), reason: payload.reason }))
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          setStatus({ enabled: false, reason: "Consensus status is unavailable." });
        }
      });
    return () => controller.abort();
  }, []);

  async function runSearch() {
    if (!query.trim() || searching || !status?.enabled) return;
    setSearching(true);
    setError("");
    setPapers([]);
    try {
      const response = await fetch("/api/consensus/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          pageSize: 6,
          excludePreprints: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Consensus search failed.");
      setPapers(Array.isArray(payload.papers) ? payload.papers : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Consensus search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function copy(kind: "reference" | "markdown", paper: Paper) {
    const value = kind === "reference" ? consensusReference(paper) : consensusMarkdownCitation(paper);
    await navigator.clipboard.writeText(value);
    const key = `${kind}-${paper.id || paper.url}`;
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1300);
  }

  return (
    <section className="consensus-citation-panel" aria-label="Consensus citations">
      <div className="consensus-citation-heading">
        <div>
          <span className="consensus-mark" aria-hidden="true">C</span>
          <div><strong>Consensus</strong><small>Peer-reviewed citations</small></div>
        </div>
        <span className={`codex-status ${status?.enabled ? "ready" : ""}`}>
          {status === null ? "checking" : status.enabled ? "ready" : "offline"}
        </span>
      </div>

      <p className="consensus-citation-intro">
        Search the literature for this research note. Results are suggestions until you review and cite them.
      </p>

      <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="consensus-citation-search">
        <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={3} aria-label="Consensus citation query" />
        <button type="submit" disabled={!status?.enabled || searching || !query.trim()}>
          {searching ? "Searching…" : "Search Consensus"}
        </button>
      </form>

      {status && !status.enabled && <p className="consensus-citation-unavailable">{status.reason}</p>}
      {error && <p className="consensus-citation-error">{error}</p>}

      {papers.length > 0 && (
        <div className="consensus-citation-results">
          {papers.map((paper) => {
            const id = paper.id || paper.url;
            return (
              <article key={id} className="consensus-citation-result">
                <a href={paper.url} target="_blank" rel="noreferrer">{paper.title}</a>
                <small>{authorLine(paper)}{paper.year ? ` · ${paper.year}` : ""}{paper.journal ? ` · ${paper.journal}` : ""}</small>
                {(paper.takeaway || paper.abstract) && <p>{paper.takeaway || paper.abstract?.slice(0, 220)}</p>}
                <div className="consensus-citation-meta">
                  {paper.studyType && <span>{paper.studyType}</span>}
                  {paper.citationCount !== undefined && <span>{paper.citationCount} citations</span>}
                  {paper.doi && <span>DOI</span>}
                </div>
                <div className="consensus-citation-actions">
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
    </section>
  );
}
