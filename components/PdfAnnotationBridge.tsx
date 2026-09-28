"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./PdfAnnotationBridge.module.css";

type AnnotationType = "highlight" | "comment" | "evidence" | "claim" | "question" | "limitation" | "method" | "definition" | "important" | "area" | "figure" | "table";
type AnchorKind = "text" | "region";
type AnchorStatus = "current" | "stale" | "legacy";
type Rect = { x: number; y: number; width: number; height: number };
type EvidenceLink = { slug: string; title: string; filename: string };
type Annotation = {
  id: string;
  type: AnnotationType;
  page: number;
  anchorKind: AnchorKind;
  quote: { exact: string; prefix?: string; suffix?: string };
  rects: Rect[];
  anchorStatus?: AnchorStatus;
  anchorHistory?: unknown[];
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
  document?: { sha256: string; staleCount: number; legacyCount: number } | null;
  enabled?: boolean;
  reason?: string;
  types?: AnnotationType[];
};
type SelectionCapture = {
  anchorKind: AnchorKind;
  page: number;
  quote: { exact: string; prefix?: string; suffix?: string };
  rects: Rect[];
  pageTextSha256?: string;
  pageTextIndex?: number;
  clientX: number;
  clientY: number;
};
type RegionDraft = { x: number; y: number; width: number; height: number } | null;
type RegionMode = { targetId?: string } | null;

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
  area: "Area",
  figure: "Figure",
  table: "Table",
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
  area: "#65a8ff",
  figure: "#9b83f3",
  table: "#58c98d",
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

function normalizedPageText(page: HTMLElement) {
  return page.querySelector<HTMLElement>(".textLayer")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

async function sha256Text(value: string) {
  if (!value || !globalThis.crypto?.subtle) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function captureSelectionFromPage(): Promise<SelectionCapture | null> {
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

  const text = normalizedPageText(page);
  const index = text.indexOf(exact);
  const prefix = index >= 0 ? text.slice(Math.max(0, index - 120), index).trim() : "";
  const suffix = index >= 0 ? text.slice(index + exact.length, index + exact.length + 120).trim() : "";
  const bounding = range.getBoundingClientRect();
  return {
    anchorKind: "text",
    page: pageNumberFor(page),
    quote: { exact, ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}) },
    rects,
    ...(text ? { pageTextSha256: await sha256Text(text) } : {}),
    ...(index >= 0 ? { pageTextIndex: index } : {}),
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<AnnotationType>("comment");
  const [editComment, setEditComment] = useState("");
  const [editTags, setEditTags] = useState("");
  const [reanchorId, setReanchorId] = useState<string | null>(null);
  const [regionMode, setRegionMode] = useState<RegionMode>(null);
  const [regionDraft, setRegionDraft] = useState<RegionDraft>(null);
  const [regionStart, setRegionStart] = useState<{ x: number; y: number } | null>(null);
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
      if (regionMode) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void captureSelectionFromPage().then((next) => {
          if (next) setCapture(next);
        });
      }, 0);
    };
    window.addEventListener("pointerup", inspect);
    window.addEventListener("touchend", inspect);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerup", inspect);
      window.removeEventListener("touchend", inspect);
    };
  }, [regionMode]);

  useEffect(() => {
    if (!regionMode && !reanchorId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setRegionMode(null);
      setRegionDraft(null);
      setRegionStart(null);
      setReanchorId(null);
      setCapture(null);
      setMessage("Re-anchor/area selection cancelled.");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reanchorId, regionMode]);

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

  const anchorPayload = useCallback((value: SelectionCapture) => ({
    page: value.page,
    anchorKind: value.anchorKind,
    quote: value.quote,
    rects: value.rects,
    pageTextSha256: value.pageTextSha256,
    pageTextIndex: value.pageTextIndex,
  }), []);

  const create = useCallback(async (nextType: AnnotationType, nextComment = "", nextTags: string[] = []) => {
    if (!capture) return;
    const result = await mutate({
      action: "create",
      annotation: {
        type: nextType,
        ...anchorPayload(capture),
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
  }, [anchorPayload, capture, mutate]);

  const reanchor = useCallback(async (id: string, nextCapture: SelectionCapture) => {
    const result = await mutate({ action: "reanchor", id, anchor: anchorPayload(nextCapture) });
    if (!result) return;
    setCapture(null);
    setReanchorId(null);
    setRegionMode(null);
    setRegionDraft(null);
    setMessage("Annotation re-anchored. Previous geometry is preserved in anchor history.");
    window.getSelection()?.removeAllRanges();
  }, [anchorPayload, mutate]);

  const promote = useCallback(async (annotation: Annotation) => {
    const result = await mutate({ action: "promote", id: annotation.id });
    if (!result?.evidence) return;
    setMessage(result.existing
      ? `This annotation is already linked to ${result.evidence.title}.`
      : `Promoted to durable evidence: ${result.evidence.title}.`);
  }, [mutate]);

  const beginEdit = (annotation: Annotation) => {
    setEditingId(annotation.id);
    setEditType(annotation.type);
    setEditComment(annotation.comment);
    setEditTags(annotation.tags.join(", "));
    setComposerOpen(false);
    setError("");
    setMessage("");
  };

  const saveEdit = useCallback(async (annotation: Annotation) => {
    const result = await mutate({
      action: "update",
      id: annotation.id,
      patch: {
        type: editType,
        comment: editComment,
        tags: editTags.split(",").map((tag) => tag.trim()).filter(Boolean),
        color: colors[editType],
      },
    });
    if (!result) return;
    setEditingId(null);
    setMessage("Annotation updated.");
  }, [editComment, editTags, editType, mutate]);

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
    setEditingId(null);
    setDrawerOpen(true);
  };

  const beginArea = (targetId?: string) => {
    setCapture(null);
    window.getSelection()?.removeAllRanges();
    setRegionMode({ ...(targetId ? { targetId } : {}) });
    setRegionDraft(null);
    setRegionStart(null);
    setDrawerOpen(false);
    setComposerOpen(false);
    setReanchorId(targetId ?? null);
    setMessage(targetId ? "Drag a new region on the PDF to re-anchor this annotation." : "Drag over a figure, table, equation, or scanned region.");
  };

  const beginTextReanchor = (annotation: Annotation) => {
    setReanchorId(annotation.id);
    setRegionMode(null);
    setCapture(null);
    setDrawerOpen(false);
    setMessage("Select the replacement text in the PDF, then choose Re-anchor here. Press Esc to cancel.");
  };

  const handleRegionPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!regionMode || event.button !== 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const x = clamp((event.clientX - box.left) / box.width);
    const y = clamp((event.clientY - box.top) / box.height);
    setRegionStart({ x, y });
    setRegionDraft({ x, y, width: 0.0001, height: 0.0001 });
  };

  const handleRegionPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!regionMode || !regionStart) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - box.left) / box.width);
    const y = clamp((event.clientY - box.top) / box.height);
    setRegionDraft({
      x: Math.min(regionStart.x, x),
      y: Math.min(regionStart.y, y),
      width: Math.max(0.0001, Math.abs(x - regionStart.x)),
      height: Math.max(0.0001, Math.abs(y - regionStart.y)),
    });
  };

  const handleRegionPointerUp = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (!regionMode || !regionStart) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - box.left) / box.width);
    const y = clamp((event.clientY - box.top) / box.height);
    const rect = {
      x: Math.min(regionStart.x, x),
      y: Math.min(regionStart.y, y),
      width: Math.abs(x - regionStart.x),
      height: Math.abs(y - regionStart.y),
    };
    setRegionStart(null);
    setRegionDraft(null);
    if (rect.width < 0.008 || rect.height < 0.008 || !pageHost) {
      setError("Drag a larger region to create an annotation.");
      return;
    }
    const text = normalizedPageText(pageHost);
    const nextCapture: SelectionCapture = {
      anchorKind: "region",
      page: pageNumberFor(pageHost),
      quote: { exact: "" },
      rects: [rect],
      ...(text ? { pageTextSha256: await sha256Text(text) } : {}),
      clientX: Math.max(16, Math.min(window.innerWidth - 16, box.left + (rect.x + rect.width / 2) * box.width)),
      clientY: Math.max(16, box.top + rect.y * box.height),
    };
    if (regionMode.targetId) {
      await reanchor(regionMode.targetId, nextCapture);
      return;
    }
    setRegionMode(null);
    setCapture(nextCapture);
    setType("area");
    setComment("");
    setTags("");
    setComposerOpen(true);
    setDrawerOpen(true);
  };

  return (
    <>
      {pageHost && createPortal(
        <>
          <div className={styles.overlay} aria-hidden="true">
            {annotationsOnPage.flatMap((annotation) => annotation.rects.map((rect, index) => (
              <span
                key={`${annotation.id}-${index}`}
                className={styles.mark}
                data-type={annotation.type}
                data-anchor-status={annotation.anchorStatus ?? "legacy"}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  "--annotation-color": annotation.color,
                } as CSSProperties}
              />
            )))}
          </div>
          {regionMode && (
            <div
              className={styles.regionCaptureLayer}
              onPointerDown={handleRegionPointerDown}
              onPointerMove={handleRegionPointerMove}
              onPointerUp={(event) => void handleRegionPointerUp(event)}
              role="application"
              aria-label={regionMode.targetId ? "Drag to re-anchor annotation region" : "Drag to annotate a PDF region"}
            >
              {regionDraft && (
                <span
                  className={styles.regionDraft}
                  style={{
                    left: `${regionDraft.x * 100}%`,
                    top: `${regionDraft.y * 100}%`,
                    width: `${regionDraft.width * 100}%`,
                    height: `${regionDraft.height * 100}%`,
                  }}
                />
              )}
            </div>
          )}
        </>,
        pageHost,
      )}

      {(regionMode || reanchorId) && (
        <div className={styles.captureHint}>
          <span>{regionMode ? "Drag on the PDF to select a region" : "Select replacement text in the PDF"}</span>
          {!regionMode && reanchorId && <button type="button" onClick={() => beginArea(reanchorId)}>Use area instead</button>}
          <button type="button" onClick={() => { setRegionMode(null); setReanchorId(null); setCapture(null); setRegionDraft(null); }}>Cancel</button>
        </div>
      )}

      {capture && state.enabled !== false && capture.anchorKind === "text" && (
        <div className={styles.selectionToolbar} style={{ left: capture.clientX, top: capture.clientY }} role="toolbar" aria-label="Annotate selected PDF text">
          {reanchorId ? (
            <button type="button" className={styles.primary} disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => void reanchor(reanchorId, capture)}>Re-anchor here</button>
          ) : (
            <>
              <button type="button" className={styles.primary} disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => void create("highlight")}>Highlight</button>
              <button type="button" disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => void create("evidence")}>Evidence</button>
              <button type="button" disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => openComposer("comment")}>Comment</button>
              <button type="button" disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => openComposer("question")}>Question</button>
            </>
          )}
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setCapture(null); setReanchorId(null); }} aria-label="Dismiss annotation toolbar">×</button>
        </div>
      )}

      {!drawerOpen && !regionMode && (
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
              {capture.anchorKind === "region" && <p className={styles.message}>Region anchor · use Figure or Table when the selection has a specific research role.</p>}
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={capture.anchorKind === "region" ? "Describe this figure/table/region…" : type === "comment" ? "Leave a comment…" : "Add an interpretation, caveat, or note…"} required={type === "comment"} />
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tags, comma, separated" />
              <div className={styles.itemActions}>
                <button type="submit" className={styles.primary} disabled={saving}>Save annotation</button>
                <button type="button" onClick={() => { setComposerOpen(false); setCapture(null); }}>Cancel</button>
              </div>
            </form>
          )}

          <div className={styles.drawerControls}>
            <label><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} /> Show hidden</label>
            <button type="button" disabled={saving || state.enabled === false} onClick={() => beginArea()}>Select area</button>
            <span>Revision {state.revision}</span>
          </div>

          {(state.document?.staleCount || state.document?.legacyCount) ? (
            <div className={styles.anchorWarning}>
              {state.document?.staleCount ? <span>{state.document.staleCount} annotation{state.document.staleCount === 1 ? "" : "s"} anchored to an older PDF revision.</span> : null}
              {state.document?.legacyCount ? <span>{state.document.legacyCount} legacy annotation{state.document.legacyCount === 1 ? "" : "s"} can be upgraded by re-anchoring.</span> : null}
            </div>
          ) : null}

          <div className={styles.list}>
            {error && <p className={`${styles.message} ${styles.error}`}>{error}</p>}
            {message && <p className={styles.message}>{message}</p>}
            {!visibleItems.length && <div className={styles.empty}>Select text or choose <strong>Select area</strong> to annotate a figure, table, equation, or scanned region. Hidden annotations remain recoverable.</div>}
            {visibleItems.map((annotation) => (
              <article key={annotation.id} className={styles.item} data-hidden={Boolean(annotation.deletedAt)} data-anchor-status={annotation.anchorStatus ?? "legacy"}>
                <div className={styles.itemMeta}>
                  <span className={styles.typeBadge}><span className={styles.swatch} style={annotationStyle(annotation.color)} />{labels[annotation.type]}</span>
                  <span>p. {annotation.page} · {annotation.anchorKind === "region" ? "region" : "text"}</span>
                </div>
                {annotation.anchorStatus && annotation.anchorStatus !== "current" && (
                  <p className={styles.anchorStatus} data-status={annotation.anchorStatus}>
                    {annotation.anchorStatus === "stale" ? "PDF changed since this anchor was saved." : "Legacy anchor has no document fingerprint yet."}
                  </p>
                )}
                {annotation.quote.exact && <blockquote className={styles.quote}>{annotation.quote.exact}</blockquote>}
                {!annotation.quote.exact && annotation.anchorKind === "region" && <p className={styles.regionLabel}>Visual region · {Math.round((annotation.rects[0]?.width ?? 0) * 100)}% × {Math.round((annotation.rects[0]?.height ?? 0) * 100)}% of page</p>}
                {editingId === annotation.id && !annotation.deletedAt ? (
                  <form className={styles.inlineEditor} onSubmit={(event) => { event.preventDefault(); void saveEdit(annotation); }}>
                    <div className={styles.composerRow}>
                      <select value={editType} onChange={(event) => setEditType(event.target.value as AnnotationType)} aria-label="Edit annotation type">
                        {(state.types ?? (Object.keys(labels) as AnnotationType[])).map((item) => <option key={item} value={item}>{labels[item]}</option>)}
                      </select>
                      <span className={styles.editSwatch} style={annotationStyle(colors[editType])} aria-hidden="true" />
                    </div>
                    <textarea value={editComment} onChange={(event) => setEditComment(event.target.value)} placeholder="Comment or interpretation…" required={editType === "comment"} />
                    <input value={editTags} onChange={(event) => setEditTags(event.target.value)} placeholder="tags, comma, separated" />
                    <div className={styles.itemActions}>
                      <button type="submit" className={styles.primary} disabled={saving}>Save changes</button>
                      <button type="button" disabled={saving} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    {annotation.comment && <p className={styles.comment}>{annotation.comment}</p>}
                    {annotation.tags.length > 0 && <p className={styles.message}>{annotation.tags.map((tag) => `#${tag}`).join(" · ")}</p>}
                  </>
                )}
                {annotation.evidence && <p className={styles.promotionStatus}>Durable evidence created · {annotation.evidence.title}</p>}
                <div className={styles.itemActions}>
                  {annotation.evidence ? (
                    <a className={styles.actionLink} href={`/progress/${encodeURIComponent(annotation.evidence.slug)}`}>Open evidence</a>
                  ) : !annotation.deletedAt && annotation.quote.exact.trim().length >= 3 ? (
                    <button type="button" className={styles.primary} disabled={saving} onClick={() => void promote(annotation)}>Promote to evidence</button>
                  ) : null}
                  {!annotation.deletedAt && editingId !== annotation.id && (
                    <button type="button" disabled={saving} onClick={() => beginEdit(annotation)}>Edit</button>
                  )}
                  {!annotation.deletedAt && (
                    annotation.anchorKind === "region"
                      ? <button type="button" disabled={saving} onClick={() => beginArea(annotation.id)}>Re-anchor area</button>
                      : <button type="button" disabled={saving} onClick={() => beginTextReanchor(annotation)}>Re-anchor text</button>
                  )}
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
