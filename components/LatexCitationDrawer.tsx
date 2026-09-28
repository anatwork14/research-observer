"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./LatexCitationDrawer.module.css";

type CitationCandidate = {
  slug: string;
  title: string;
  bibliographicTitle: string;
  type: string;
  sourceKind: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
  pdfPath?: string;
  metadataSlug: string;
  metadataTitle: string;
  citationReady: boolean;
  missing: string[];
  researchHref: string;
  paperHref: string | null;
};

type CitationSearch = {
  items: CitationCandidate[];
  bibFiles: string[];
  defaultBibFile: string;
  enabled?: boolean;
  reason?: string;
};

type CitationResult = {
  created: boolean;
  bibFileCreated: boolean;
  key: string;
  bibFile: string;
  candidate: CitationCandidate;
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Citation request failed.");
  return payload;
}

export function LatexCitationDrawer({
  projectId,
  open,
  onClose,
  validateInsert,
  onInsert,
  onLibraryChanged,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  validateInsert: () => void;
  onInsert: (key: string, bibFile: string) => void;
  onLibraryChanged: () => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<CitationSearch>({ items: [], bibFiles: [], defaultBibFile: "references.bib" });
  const [bibFile, setBibFile] = useState("references.bib");
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (needle = "") => {
    setLoading(true);
    setError("");
    try {
      const payload = await requestJson(`/api/ide/citations?research=${encodeURIComponent(projectId)}&q=${encodeURIComponent(needle)}`) as CitationSearch;
      setData(payload);
      setBibFile((current) => {
        if (payload.bibFiles.includes(current)) return current;
        return payload.defaultBibFile || "references.bib";
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load research citations.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void load(query), 180);
    return () => window.clearTimeout(timer);
  }, [load, open, query]);

  useEffect(() => {
    if (!open) {
      setError("");
      setMessage("");
      setWriting("");
    }
  }, [open]);

  const bibChoices = useMemo(() => {
    const values = new Set(data.bibFiles);
    values.add(bibFile || data.defaultBibFile || "references.bib");
    return [...values];
  }, [bibFile, data.bibFiles, data.defaultBibFile]);

  const insert = async (candidate: CitationCandidate) => {
    if (!candidate.citationReady || writing) return;
    setError("");
    setMessage("");
    try {
      validateInsert();
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Open a .tex source before inserting a citation.");
      return;
    }

    setWriting(candidate.slug);
    try {
      const result = await requestJson("/api/ide/citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure", research: projectId, slug: candidate.slug, bibFile }),
      }) as CitationResult;
      await onLibraryChanged();
      onInsert(result.key, result.bibFile);
      setMessage(result.created
        ? `Added ${result.key} to ${result.bibFile} and inserted the citation.`
        : `Reused ${result.key} from ${result.bibFile} and inserted the citation.`);
      if (result.bibFileCreated || !data.bibFiles.includes(result.bibFile)) await load(query);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not insert citation.");
    } finally {
      setWriting("");
    }
  };

  if (!open) return null;

  return (
    <aside className={styles.drawer} aria-label="Research citations">
      <header className={styles.header}>
        <div>
          <strong>Citations</strong>
          <small>Verified project literature and evidence</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Close citation drawer">×</button>
      </header>

      <div className={styles.controls}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, author, DOI, tag…"
          aria-label="Search citation sources"
          autoFocus
        />
        <label>
          <span>Library</span>
          <select value={bibFile} onChange={(event) => setBibFile(event.target.value)}>
            {bibChoices.map((file) => <option key={file} value={file}>{file}</option>)}
          </select>
        </label>
        {!data.bibFiles.length && <p className={styles.hint}>The first citation will create <code>{bibFile}</code>.</p>}
      </div>

      <div className={styles.feedback}>
        {error && <p className={styles.error}>{error}</p>}
        {message && <p>{message}</p>}
        {!error && !message && data.reason && <p>{data.reason}</p>}
      </div>

      <div className={styles.list} aria-busy={loading}>
        {loading && !data.items.length && <p className={styles.empty}>Loading research sources…</p>}
        {!loading && !data.items.length && <p className={styles.empty}>No project literature or evidence matches this search.</p>}
        {data.items.map((candidate) => (
          <article className={styles.item} key={candidate.slug} data-ready={candidate.citationReady}>
            <div className={styles.itemHeader}>
              <span className={styles.kind}>{candidate.type}</span>
              <span>{candidate.sourceKind}</span>
            </div>
            <strong>{candidate.bibliographicTitle || candidate.title}</strong>
            {candidate.metadataSlug !== candidate.slug && (
              <small className={styles.inherited}>Bibliography metadata from {candidate.metadataTitle}</small>
            )}
            <p className={styles.meta}>
              {candidate.authors.length ? candidate.authors.join(", ") : "Authors missing"}
              {candidate.year ? ` · ${candidate.year}` : " · Year missing"}
            </p>
            {candidate.doi && <p className={styles.identifier}>DOI {candidate.doi}</p>}
            {!candidate.citationReady && (
              <p className={styles.missing}>Add verified {candidate.missing.join(", ")} before citing this source.</p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                disabled={!candidate.citationReady || Boolean(writing) || data.enabled === false}
                onClick={() => void insert(candidate)}
              >
                {writing === candidate.slug ? "Adding…" : "Insert citation"}
              </button>
              <a href={candidate.researchHref}>Open note</a>
              {candidate.paperHref && <a href={candidate.paperHref}>Open PDF</a>}
              {candidate.url && <a href={candidate.url} target="_blank" rel="noreferrer">Source ↗</a>}
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
