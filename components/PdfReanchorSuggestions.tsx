"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { pdfjs } from "react-pdf";
import { findPdfReanchorCandidates, type PdfReanchorCandidate, type PdfReanchorPageText } from "@/lib/research/pdf-reanchor-candidates.mjs";
import styles from "./PdfReanchorSuggestions.module.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/_research/pdfjs/pdf.worker.min.mjs";

const documentOptions = {
  cMapUrl: "/_research/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/_research/pdfjs/standard_fonts/",
  wasmUrl: "/_research/pdfjs/wasm/",
};

type TextAnnotation = {
  id: string;
  page: number;
  anchorKind: "text" | "region";
  anchorStatus?: "current" | "stale" | "legacy";
  quote: { exact: string; prefix?: string; suffix?: string };
  anchor?: { pageTextIndex?: number } | null;
  deletedAt: string | null;
};

type PdfTextDocument = {
  numPages: number;
  getPage: (page: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }>;
  destroy?: () => Promise<void>;
};

function textFromItems(items: Array<{ str?: string }>) {
  return items.map((item) => item.str ?? "").join(" ").replace(/\s+/g, " ").trim();
}

export function PdfReanchorSuggestions({ paperPath, src }: { paperPath: string; src: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [loadingState, setLoadingState] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [searchingId, setSearchingId] = useState("");
  const [results, setResults] = useState<Record<string, PdfReanchorCandidate[]>>({});
  const [error, setError] = useState("");
  const pagesRef = useRef<PdfReanchorPageText[] | null>(null);
  const pdfRef = useRef<PdfTextDocument | null>(null);

  const loadAnnotations = useCallback(async () => {
    setLoadingState(true);
    try {
      const response = await fetch(`/api/papers/annotations?paper=${encodeURIComponent(paperPath)}&includeDeleted=1`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load annotation anchors.");
      const next = (Array.isArray(payload.annotations) ? payload.annotations : [])
        .filter((annotation: TextAnnotation) =>
          !annotation.deletedAt &&
          annotation.anchorKind === "text" &&
          annotation.anchorStatus !== "current" &&
          annotation.quote?.exact?.trim().length >= 3,
        );
      setAnnotations(next);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load annotation anchors.");
    } finally {
      setLoadingState(false);
    }
  }, [paperPath]);

  useEffect(() => {
    void loadAnnotations();
  }, [loadAnnotations]);

  useEffect(() => {
    return () => {
      const document = pdfRef.current;
      if (document?.destroy) void document.destroy().catch(() => null);
    };
  }, []);

  const extractPages = useCallback(async () => {
    if (pagesRef.current) return pagesRef.current;
    setExtracting(true);
    try {
      const task = pdfjs.getDocument({ url: src, ...documentOptions });
      const document = await task.promise as unknown as PdfTextDocument;
      pdfRef.current = document;
      const pages: PdfReanchorPageText[] = [];
      for (let page = 1; page <= document.numPages; page += 1) {
        const pdfPage = await document.getPage(page);
        const content = await pdfPage.getTextContent();
        pages.push({ page, text: textFromItems(content.items) });
      }
      pagesRef.current = pages;
      return pages;
    } finally {
      setExtracting(false);
    }
  }, [src]);

  const findMatches = useCallback(async (annotation: TextAnnotation) => {
    setSearchingId(annotation.id);
    setError("");
    try {
      const pages = await extractPages();
      const candidates = findPdfReanchorCandidates({
        pages,
        quote: annotation.quote.exact,
        prefix: annotation.quote.prefix,
        suffix: annotation.quote.suffix,
        hint: { page: annotation.page, pageTextIndex: annotation.anchor?.pageTextIndex },
        limit: 6,
      });
      setResults((current) => ({ ...current, [annotation.id]: candidates }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not search this PDF for re-anchor candidates.");
    } finally {
      setSearchingId("");
    }
  }, [extractPages]);

  if (!loadingState && !annotations.length) return null;

  return (
    <>
      {!open && (
        <button type="button" className={styles.launcher} onClick={() => { setOpen(true); void loadAnnotations(); }}>
          Anchor suggestions{annotations.length ? ` ${annotations.length}` : ""}
        </button>
      )}

      {open && (
        <aside className={styles.drawer} aria-label="PDF re-anchor suggestions">
          <header className={styles.header}>
            <div>
              <strong>Anchor suggestions</strong>
              <small>Read-only candidate search</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close anchor suggestions">×</button>
          </header>
          <p className={styles.hint}>
            Suggestions never move annotations. Open a candidate page, inspect it, then use <strong>Re-anchor text</strong> in the annotation drawer and select the verified source text yourself.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.body} aria-busy={extracting || Boolean(searchingId)}>
            {loadingState && <p className={styles.empty}>Loading stale/legacy anchors…</p>}
            {!loadingState && !annotations.length && <p className={styles.empty}>No stale or legacy text anchors need review.</p>}
            {annotations.map((annotation) => {
              const candidates = results[annotation.id];
              return (
                <article className={styles.item} key={annotation.id}>
                  <p className={styles.meta}>{annotation.anchorStatus ?? "legacy"} · previous page {annotation.page}</p>
                  <blockquote>{annotation.quote.exact}</blockquote>
                  <button type="button" disabled={extracting || Boolean(searchingId)} onClick={() => void findMatches(annotation)}>
                    {searchingId === annotation.id ? "Searching…" : candidates ? "Search again" : "Find candidates"}
                  </button>
                  {candidates && (
                    <div className={styles.candidates}>
                      {!candidates.length && <p className={styles.empty}>No sufficiently strong candidate was found. Re-anchor manually after locating the source.</p>}
                      {candidates.map((candidate) => (
                        <div className={styles.candidate} key={candidate.id}>
                          <div className={styles.candidateHeader}>
                            <span>Page {candidate.page} · {candidate.matchType}</span>
                            <strong>{Math.round(candidate.confidence * 100)}%</strong>
                          </div>
                          <p>{candidate.snippet}</p>
                          <a href={`${pathname}?page=${candidate.page}`}>Open page {candidate.page}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </aside>
      )}
    </>
  );
}
