"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PdfRelatedNote } from "@/components/PdfReader";

pdfjs.GlobalWorkerOptions.workerSrc = "/_research/pdfjs/pdf.worker.min.mjs";

const documentOptions = {
  cMapUrl: "/_research/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/_research/pdfjs/standard_fonts/",
  wasmUrl: "/_research/pdfjs/wasm/",
};

type PdfDocumentLike = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  }>;
};

type SearchHit = { page: number; count: number; snippet: string };

function clampPage(page: number, total: number) {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, total));
}

function textFromItems(items: Array<{ str?: string }>) {
  return items.map((item) => item.str ?? "").join(" ").replace(/\s+/g, " ").trim();
}

function LazyThumbnail({
  pageNumber,
  active,
  onSelect,
}: {
  pageNumber: number;
  active: boolean;
  onSelect: (page: number) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: "280px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      className={`pdf-thumbnail ${active ? "active" : ""}`}
      onClick={() => onSelect(pageNumber)}
      aria-current={active ? "page" : undefined}
      title={`Page ${pageNumber}`}
    >
      <span className="pdf-thumbnail-canvas">
        {visible ? (
          <Page
            pageNumber={pageNumber}
            width={116}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<span className="pdf-thumb-placeholder" />}
          />
        ) : <span className="pdf-thumb-placeholder" />}
      </span>
      <small>{pageNumber}</small>
    </button>
  );
}

export default function PdfReaderInner({
  src,
  path,
  title,
  initialPage,
  relatedNotes,
}: {
  src: string;
  path: string;
  title: string;
  initialPage: number;
  relatedNotes: PdfRelatedNote[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const stageRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PdfDocumentLike | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(Math.max(1, initialPage));
  const [pageDraft, setPageDraft] = useState(String(Math.max(1, initialPage)));
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [stageWidth, setStageWidth] = useState(920);
  const [panel, setPanel] = useState<"search" | "text" | "notes">("notes");
  const [pageText, setPageText] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selection, setSelection] = useState("");

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setStageWidth(Math.max(320, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const navigate = useCallback((nextPage: number) => {
    const next = clampPage(nextPage, numPages || 1);
    setPageNumber(next);
    setPageDraft(String(next));
    setSelection("");
    router.replace(`${pathname}?page=${next}`, { scroll: false });
  }, [numPages, pathname, router]);

  useEffect(() => {
    if (!pdf || panel !== "text") return;
    let cancelled = false;
    setTextLoading(true);
    pdf.getPage(pageNumber)
      .then((page) => page.getTextContent())
      .then((content) => { if (!cancelled) setPageText(textFromItems(content.items)); })
      .catch(() => { if (!cancelled) setPageText("Text extraction is unavailable for this page."); })
      .finally(() => { if (!cancelled) setTextLoading(false); });
    return () => { cancelled = true; };
  }, [pageNumber, panel, pdf]);

  async function runSearch() {
    const needle = search.trim().toLowerCase();
    if (!pdf || needle.length < 2) {
      setHits([]);
      return;
    }

    setSearching(true);
    const nextHits: SearchHit[] = [];
    try {
      for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
        const page = await pdf.getPage(pageIndex);
        const content = await page.getTextContent();
        const text = textFromItems(content.items);
        const lower = text.toLowerCase();
        let count = 0;
        let from = 0;
        while (true) {
          const found = lower.indexOf(needle, from);
          if (found < 0) break;
          count += 1;
          from = found + needle.length;
        }
        if (count) {
          const index = lower.indexOf(needle);
          const start = Math.max(0, index - 70);
          const end = Math.min(text.length, index + needle.length + 100);
          nextHits.push({
            page: pageIndex,
            count,
            snippet: `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
          });
        }
      }
      setHits(nextHits);
    } finally {
      setSearching(false);
    }
  }

  function captureSelection() {
    const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    setSelection(selected.length >= 3 ? selected : "");
  }

  const renderWidth = useMemo(() => {
    const fitted = Math.min(940, Math.max(300, stageWidth - 64));
    return Math.round(fitted * zoom);
  }, [stageWidth, zoom]);

  return (
    <Document
      file={src}
      options={documentOptions}
      onLoadSuccess={(loaded) => {
        const document = loaded as unknown as PdfDocumentLike;
        setPdf(document);
      setNumPages(document.numPages);
        setPageNumber((current) => {
          const next = clampPage(current, document.numPages);
          setPageDraft(String(next));
          return next;
        });
      }}
      loading={<div className="pdf-loading panel">Opening {title}…</div>}
      error={<div className="pdf-loading panel error">This PDF failed to render. <a href={src}>Open original</a>.</div>}
    >
      <div className="pdf-workbench">
        <header className="pdf-toolbar panel">
          <div className="pdf-title-block">
            <Link href="/papers" aria-label="Back to papers">←</Link>
            <div><strong>{title}</strong><small>{path}</small></div>
          </div>
          <div className="pdf-page-controls">
            <button onClick={() => navigate(pageNumber - 1)} disabled={pageNumber <= 1} aria-label="Previous page">←</button>
            <label>
              <input
                value={pageDraft}
                onChange={(event) => setPageDraft(event.target.value.replace(/\D/g, ""))}
                onBlur={() => navigate(Number(pageDraft || pageNumber))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") navigate(Number(pageDraft || pageNumber));
                  if (event.key === "Escape") setPageDraft(String(pageNumber));
                }}
                inputMode="numeric"
                aria-label="Current page"
              />
              <span>/ {numPages || "—"}</span>
            </label>
            <button onClick={() => navigate(pageNumber + 1)} disabled={!numPages || pageNumber >= numPages} aria-label="Next page">→</button>
          </div>
          <div className="pdf-view-controls">
            <button onClick={() => setZoom((value) => Math.max(.55, value - .1))} aria-label="Zoom out">−</button>
            <button className="pdf-zoom-label" onClick={() => setZoom(1)} title="Fit width">{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom((value) => Math.min(2.4, value + .1))} aria-label="Zoom in">+</button>
            <button onClick={() => setRotation((value) => (value + 90) % 360)} aria-label="Rotate clockwise">↬</button>
            <a href={src} target="_blank" rel="noreferrer" title="Open original PDF">↗</a>
          </div>
        </header>

        <div className="pdf-layout">
          <aside className="pdf-thumbnails panel" aria-label="PDF pages">
            <span className="kicker">Pages</span>
            <div className="pdf-thumbnail-list">
              {Array.from({ length: numPages }, (_, index) => index + 1).map((page) => (
                <LazyThumbnail key={page} pageNumber={page} active={page === pageNumber} onSelect={navigate} />
              ))}
            </div>
          </aside>

          <main className="pdf-stage panel" ref={stageRef} onMouseUp={captureSelection}>
            <div className="pdf-page-wrap">
              <Page
                pageNumber={pageNumber}
                width={renderWidth}
                rotate={rotation}
                renderTextLayer
                renderAnnotationLayer
                loading={<div className="pdf-page-loading">Rendering page {pageNumber}…</div>}
              />
            </div>
            {selection && (
              <div className="pdf-selection-bar" role="toolbar" aria-label="Selected PDF text">
                <span>{selection.length > 90 ? selection.slice(0, 87) + "…" : selection}</span>
                <button onClick={() => navigator.clipboard.writeText(selection)}>Copy</button>
                <button onClick={() => navigator.clipboard.writeText(`> ${selection}\n\nSource: ${title}, p. ${pageNumber}`)}>Copy evidence</button>
              </div>
            )}
          </main>

          <aside className="pdf-inspector panel">
            <div className="pdf-inspector-tabs" role="tablist" aria-label="PDF inspector">
              <button className={panel === "notes" ? "active" : ""} onClick={() => setPanel("notes")}>Notes</button>
              <button className={panel === "search" ? "active" : ""} onClick={() => setPanel("search")}>Search</button>
              <button className={panel === "text" ? "active" : ""} onClick={() => setPanel("text")}>Text</button>
            </div>

            {panel === "notes" && (
              <div className="pdf-panel-body">
                <span className="kicker">Related research</span>
                <h3>Notes referencing this paper</h3>
                <div className="connection-list">
                  {relatedNotes.map((note) => (
                    <Link key={note.slug} href={`/progress/${note.slug}`}><span>{String(note.order).padStart(2, "0")}</span>{note.title}</Link>
                  ))}
                  {!relatedNotes.length && <span className="connection-empty">No research note references this PDF yet.</span>}
                </div>
                <div className="pdf-source-card"><span>Source</span><code>{path}</code><small>Page {pageNumber} of {numPages || "—"}</small></div>
              </div>
            )}

            {panel === "search" && (
              <div className="pdf-panel-body">
                <form className="pdf-search-form" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this PDF…" aria-label="Search PDF" />
                  <button type="submit" disabled={searching}>{searching ? "…" : "⌕"}</button>
                </form>
                <div className="pdf-search-results">
                  {hits.map((hit) => (
                    <button key={hit.page} onClick={() => navigate(hit.page)}>
                      <strong>Page {hit.page} <em>{hit.count}×</em></strong>
                      <small>{hit.snippet}</small>
                    </button>
                  ))}
                  {!searching && search.trim().length >= 2 && !hits.length && <p className="quiet">No matching text found.</p>}
                </div>
              </div>
            )}

            {panel === "text" && (
              <div className="pdf-panel-body">
                <span className="kicker">Accessible text view</span>
                <h3>Page {pageNumber}</h3>
                <p className="pdf-text-view">{textLoading ? "Extracting text…" : pageText || "Open this tab to extract selectable page text."}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Document>
  );
}
