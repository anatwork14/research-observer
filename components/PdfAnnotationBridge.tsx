"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./PdfAnnotationBridge.module.css";

type AnnotationType = "highlight" | "comment" | "evidence" | "claim" | "question" | "limitation" | "method" | "definition" | "important";
type Rect = { x: number; y: number; width: number; height: number };
type EvidenceLink = { slug: string; title: string; filename: string };
type Annotation = {
  id: string;
  type: AnnotationType;
  page: number;
  quote: { exact: string; prefix?: string; suffix?: string };
  rects: Rect[];
  comment: string;
  tags: string[];
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  evidence?: EvidenceLink | null;
};
type AnnotationState = {
  revision: number;
  annotations: Annotation[];
  hiddenCount: number;
  enabled?: boolean;
  reason?: string;
  types?: AnnotationType[];
};
type SelectionCapture = {
  page: number;
  quote: { exact: string; prefix?: string; suffix?: string };
  rects: Rect[];
  clientX: number;
  clientY: number;
};

const labels: Record<AnnotationType, string> = {
  highlight: "Highlight",
  comment: "Comment",
  evidence: "Evidence",
  claim: "Claim",
  question: "Question",
  limitation: "Limitation",
  method: "Method",
  definition: "Definition",
  important: "Important",
};

const colors: Record<AnnotationType, string> = {
  highlight: "#f4c95d",
  comment: "#65a8ff",
  evidence: "#58c98d",
  claim: "#9b83f3",
  question: "#65a8ff",
  limitation: "#eb707d",
  method: "#df9f53",
  definition: "#69c7c2",
  important: "#f0b05a",
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function annotationStyle(color: string): CSSProperties {
  return { "--annotation-color": color } as CSSProperties;
}

function pageNumberFor(element: HTMLElement) {
  const fromDom = Number(element.dataset.pageNumber);
  if (Number.isInteger(fromDom) && fromDom > 0) return fromDom;
  const fromUrl = Number(new URL(window.location.href).searchParams.get("page") ?? "1");
  return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 1;
}

function captureSelectionFromPage(): SelectionCapture | null {
  const selection = window.getSelection();
  const exact = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
  if (!selection || !exact || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const page = document.querySelector<HTMLElement>(".pdf-stage .react-pdf__Page");
  if (!page) return null;
  const common = range.commonAncestorContainer;
  if (!page.contains(common.nodeType === Node.ELEMENT_NODE ? common : common.parentNode)) return null;
  const pageBox = page.getBoundingClientRect();
  if (!pageBox.width || !pageBox.height) return null;
  const rects = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5 && rect.right > pageBox.left && rect.left < pageBox.right && rect.bottom > pageBox.top && rect.top < pageBox.bottom)
    .map((rect) => ({
      x: clamp((Math.max(rect.left, pageBox.left) - pageBox.left) / pageBox.width),
      y: clamp((Math.max(rect.top, pageBox.top) - pageBox.top) / pageBox.height),
      width: clamp((Math.min(rect.right, pageBox.right) - Math.max(rect.left, pageBox.left)) / pageBox.width),
      height: clamp((Math.min(rect.bottom, pageBox.bottom) - Math.max(rect.top, pageBox.top)) / pageBox.height),
    }))
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!rects.length) return null;

  const text = page.querySelector<HTMLElement>(".textLayer")?.textContent?.replace(/\s+/g, " ") ?? "";
  const index = text.indexOf(exact);
  const prefix = index >= 0 ? text.slice(Math.max(0, index - 120), index).trim() : "";
  const suffix = index >= 0 ? text.slice(index + exact.length, index + exact.length + 120).trim() : "";
  const bounding = range.getBoundingClientRect();
  return {
    page: pageNumberFor(page),
    quote: { exact, ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}) },
    rects,
    clientX: Math.max(16, Math.min(window.innerWidth - 16, bounding.left + bounding.width / 2)),
    clientY: Math.max(16, bounding.top),
  };
}

export function PdfAnnotationBridge({ paperPath }: { paperPath: string }) {
  const [state, setState] = useState<AnnotationState>({ revision: 0, annotations: [], hiddenCount: 0 });
  const [capture, setCapture] = useState<SelectionCapture | null>(null);
  const [pageHost, setPageHost] = useState<HTMLElement | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [type, setType] = useState<AnnotationType>("comment");
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/papers/annotations?paper=${encodeURIComponent(paperPath)}&includeDeleted=1`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load annotations.");
      setState(payload);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load annotations.");
    }
  }, [paperPath]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = document.querySelector<HTMLElement>(".pdf-stage .react-pdf__Page");
        setPageHost((current) => current === next ? current : next);
        if (next) setPageNumber(pageNumberFor(next));
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-page-number"],
    });
    window.addEventListener("popstate", refresh);
    window.addEventListener("resize", refresh);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("popstate", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, []);

  useEffect(() => {
    let timer = 0;
    const inspect = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = captureSelectionFromPage();
        if (next) setCapture(next);
      }, 0);
    };
    window.addEventListener("pointerup", inspect);
    window.addEventListener("touchend", inspect);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerup", inspect);
      window.removeEventListener("touchend", inspect);
    };
  }, []);

  const mutate = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/papers/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperPath, expectedRevision: state.revision, ...body }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(payload.error || "Annotation update failed.");
      }
      setState((current) => ({ ...current, ...payload }));
      return payload as AnnotationState & { evidence?: EvidenceLink; existing?: boolean };
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Annotation update failed.");
      return null;
    } finally {
      setSaving(false);
    }
  }, [load, paperPath, state.revision]);

  const create = useCallback(async (nextType: AnnotationType, nextComment = "", nextTags: string[] = []) => {
    if (!capture) return;
    const result = await mutate({
      action: "create",
      annotation: {
        type: nextType,
        page: capture.page,
        quote: capture.quote,
        rects: capture.rects,
        comment: nextComment,
        tags: nextTags,
        color: colors[nextType],
      },
    });
    if (!result) return;
    setMessage(`${labels[nextType]} saved.`);
    setCapture(null);
    setComposerOpen(false);
    setComment("");
    setTags("");
    window.getSelection()?.removeAllRanges();
  }, [capture, mutate]);

  const promote = useCallback(async (annotation: Annotation) => {
    const result = await mutate({ action: "promote", id: annotation.id });
    if (!result?.evidence) return;
    setMessage(result.existing
      ? `This annotation is already linked to ${result.evidence.title}.`
      : `Promoted to durable evidence: ${result.evidence.title}.`);
  }, [mutate]);

  const annotationsOnPage = useMemo(
    () => state.annotations.filter((annotation) => annotation.page === pageNumber && !annotation.deletedAt),
    [pageNumber, state.annotations],
  );
  const visibleItems = useMemo(
    () => state.annotations.filter((annotation) => showHidden || !annotation.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [showHidden, state.annotations],
  );

  const openComposer = (nextType: AnnotationType) => {
    setType(nextType);
    setComposerOpen(true);
    setDrawerOpen(true);
  };

  return (
    <>
      {pageHost && createPortal(
        <div className={styles.overlay} aria-hidden="true">
          {annotationsOnPage.flatMap((annotation) => annotation.rects.map((rect, index) => (
            <span
              key={`${annotation.id}-${index}`}
              className={styles.mark}
              data-type={annotation.type}
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                "--annotation-color": annotation.color,
              } as CSSProperties}
            />
          )))}
        </div>,
        pageHost,
      )}

      {capture && state.enabled !== false && (
        <div className={styles.selectionToolbar} style={{ left: capture.clientX, top: capture.clientY }} role="toolbar" aria-label="Annotate selected PDF text">
          <button type="button" className={styles.primary} disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => void create("highlight")}>Highlight</button>
          <button type="button" disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => void create("evidence")}>Evidence</button>
          <button type="button" disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => openComposer("comment")}>Comment</button>
          <button type="button" disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => openComposer("question")}>Question</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setCapture(null)} aria-label="Dismiss annotation toolbar">×</button>
        </div>
      )}

      {!drawerOpen && (
        <button type="button" className={styles.drawerToggle} onClick={() => setDrawerOpen(true)}>
          Annotations {state.annotations.filter((item) => !item.deletedAt).length}
        </button>
      )}

      {drawerOpen && (
        <aside className={styles.drawer} aria-label="PDF annotations">
          <header className={styles.drawerHeader}>
            <div>
              <strong>Annotations</strong>
              <small>{state.annotations.filter((item) => !item.deletedAt).length} active · {state.hiddenCount} hidden</small>
            </div>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close annotations">×</button>
          </header>

          {composerOpen && capture && (
            <form className={styles.composer} onSubmit={(event) => {
              event.preventDefault();
              void create(type, comment, tags.split(",").map((tag) => tag.trim()).filter(Boolean));
            }}>
              <div className={styles.composerRow}>
                <select value={type} onChange={(event) => setType(event.target.value as AnnotationType)} aria-label="Annotation type">
                  {(state.types ?? (Object.keys(labels) as AnnotationType[])).map((item) => <option key={item} value={item}>{labels[item]}</option>)}
                </select>
                <input type="color" value={colors[type]} readOnly aria-label="Annotation color" />
              </div>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={type === "comment" ? "Leave a comment…" : "Add an interpretation, caveat, or note…"} required={type === "comment"} />
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tags, comma, separated" />
              <div className={styles.itemActions}>
                <button type="submit" className={styles.primary} disabled={saving}>Save annotation</button>
                <button type="button" onClick={() => setComposerOpen(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div className={styles.drawerControls}>
            <label><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} /> Show hidden</label>
            <span>Revision {state.revision}</span>
          </div>

          <div className={styles.list}>
            {error && <p className={`${styles.message} ${styles.error}`}>{error}</p>}
            {message && <p className={styles.message}>{message}</p>}
            {!visibleItems.length && <div className={styles.empty}>Select text in the PDF, then highlight it or attach a structured comment. Hidden annotations remain recoverable.</div>}
            {visibleItems.map((annotation) => (
              <article key={annotation.id} className={styles.item} data-hidden={Boolean(annotation.deletedAt)}>
                <div className={styles.itemMeta}>
                  <span className={styles.typeBadge}><span className={styles.swatch} style={annotationStyle(annotation.color)} />{labels[annotation.type]}</span>
                  <span>p. {annotation.page}</span>
                </div>
                {annotation.quote.exact && <blockquote className={styles.quote}>{annotation.quote.exact}</blockquote>}
                {annotation.comment && <p className={styles.comment}>{annotation.comment}</p>}
                {annotation.tags.length > 0 && <p className={styles.message}>{annotation.tags.map((tag) => `#${tag}`).join(" · ")}</p>}
                {annotation.evidence && <p className={styles.promotionStatus}>Durable evidence created · {annotation.evidence.title}</p>}
                <div className={styles.itemActions}>
                  {annotation.evidence ? (
                    <a className={styles.actionLink} href={`/progress/${encodeURIComponent(annotation.evidence.slug)}`}>Open evidence</a>
                  ) : !annotation.deletedAt && annotation.quote.exact.trim().length >= 3 ? (
                    <button type="button" className={styles.primary} disabled={saving} onClick={() => void promote(annotation)}>Promote to evidence</button>
                  ) : null}
                  {annotation.deletedAt ? (
                    <button type="button" disabled={saving} onClick={() => void mutate({ action: "restore", id: annotation.id })}>Restore</button>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => void mutate({ action: "delete", id: annotation.id })}>Hide</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
